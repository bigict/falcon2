import time

from torch import nn
from collections import defaultdict
import numpy as np
import torch
import os
import sys
import logging
import math
from .common import constants
from .common.config import EPS
from .common import config
import scipy.interpolate
import functools


def cosine_schedule(init_value, cur_step, nr_step, warmup=0):
    if warmup > 0 and cur_step < warmup:
        return (cur_step + 1) / warmup * init_value
    t, T = cur_step - warmup, nr_step - warmup
    return 0.5 * (1 + math.cos(t * math.pi / T)) * init_value


def cubic_spline(x, y, period=False):
    c = scipy.interpolate.CubicSpline(x, y, axis=-1, bc_type="not-a-knot" if not period else "periodic").c
    c = torch.tensor(c).float().permute(2, 3, 1, 0)
    return c


def evaluate(c, b, x):
    idx = torch.searchsorted(b[None].contiguous(), x[None].detach().contiguous())[0] - 1
    idx = torch.clamp(idx, 0, c.shape[-2] - 1)

    x = x - b[idx]
    onehot = torch.eye(c.shape[-2], device=x.device, dtype=bool)
    c = c[onehot[idx]]

    ret = c[:, 3] + c[:, 2] * x
    t_x = x * x
    ret += c[:, 1] * t_x
    t_x = t_x * x
    ret += c[:, 0] * t_x
    return ret


class DistanceRestraint(nn.Module):

    def __init__(self, pred_dist):
        super().__init__()
        _bins = np.linspace(2.25, 19.75, num=36)
        self.cutoffs = torch.tensor([0] + _bins.tolist()).float()

        _x = self.cutoffs.numpy().tolist()
        _ref = pred_dist[:, :, -2:-1] * np.array((_bins / _bins[-1]) ** 1.57)[None, None]
        _y = -np.log(pred_dist[:, :, :-1] + EPS) + np.log(_ref + EPS)
        _y = np.concatenate([_y[:, :, :1] - np.log(EPS), _y], axis=-1)
        self.coeff = nn.Parameter(cubic_spline(_x, _y), requires_grad=False)

        L = pred_dist.shape[0]
        _filter = torch.tensor(pred_dist[:, :, -1] < config.DIST_CUT)
        self.mask = nn.Parameter(
            torch.triu(torch.ones((L, L)).bool(), diagonal=1).__and__(_filter),
            requires_grad=False,
        )

        self.cutoffs = nn.Parameter(self.cutoffs, requires_grad=False)

    def __str__(self):
        return "CBCB constraints: %i" % torch.sum(self.mask).item()

    def forward(self, coord):
        B = coord.CB.shape[0]
        x_idx, y_idx = torch.where(self.mask)
        x_CB, y_CB = coord.CB[:, x_idx].view(-1, 3), coord.CB[:, y_idx].view(-1, 3)
        x_idx, y_idx = x_idx.repeat(B), y_idx.repeat(B)
        d_CB = torch.norm(x_CB - y_CB, dim=-1)
        mask = d_CB <= self.cutoffs[-1]
        x_idx, y_idx, d_CB = x_idx[mask], y_idx[mask], d_CB[mask]
        coeff = self.coeff[x_idx, y_idx]
        cbcb_potential = torch.sum(evaluate(coeff, self.cutoffs, d_CB))

        return {
            "cbcb_distance": cbcb_potential,
        }


def distance(x, y):
    return torch.norm(x - y, dim=-1)


def pairwise_distance(x, y=None):
    if y is None:
        y = x
    return torch.norm(x[:, :, None, :] - y[:, None, :, :], dim=-1)


def calc_angle(v1, v2, v3, x_idx=None, y_idx=None, eps=1e-6):
    x = v1 - v2
    y = v3 - v2

    mask = (torch.norm(x, dim=-1) > eps).__and__(torch.norm(y, dim=-1) > eps)

    x, y = x[mask], y[mask]

    if x_idx is not None:
        x_idx, y_idx = x_idx[mask], y_idx[mask]
    nx = torch.norm(x, dim=-1)
    ny = torch.norm(y, dim=-1)
    c = torch.sum(x * y, dim=-1) / (nx * ny)

    good_grad = 1 - c * c > eps
    if x_idx is not None:
        x_idx, y_idx = x_idx[good_grad], y_idx[good_grad]
    return (x_idx, y_idx, torch.acos(c[good_grad]))


def calc_dihedral(v1, v2, v3, v4, x_idx=None, y_idx=None, eps=1e-6):
    """
    Calculate the dihedral angle between 4 vectors.
    v1, v2, v3, v4: shape (..., 3)
    x_idx, y_idx: shape (...), additional information of vectors.
    return: (x_idx, y_idy, dihedral)
    """
    x = v2 - v1
    y = v3 - v2
    z = v4 - v3

    mask = torch.norm(x, dim=-1) > eps
    mask = mask.__and__(torch.norm(y, dim=-1) > eps)
    mask = mask.__and__(torch.norm(z, dim=-1) > eps)

    x, y, z = x[mask], y[mask], z[mask]

    if x_idx is not None:
        x_idx, y_idx = x_idx[mask], y_idx[mask]

    c_xy = torch.cross(x, y)
    c_yz = torch.cross(y, z)
    sin = torch.sum(y * torch.cross(c_xy, c_yz), dim=-1)
    cos = torch.sum(c_xy * c_yz, dim=-1) * torch.norm(y, dim=-1)

    good_grad = sin * sin + cos * cos > eps
    if x_idx is not None:
        x_idx, y_idx = x_idx[good_grad], y_idx[good_grad]
    return (x_idx, y_idx, torch.atan2(sin[good_grad], cos[good_grad]))


class Prediction:
    """ Prediction of upstream neural network, such as CopularNet"""

    def __init__(self, geo_npz=None):
        self.geo = geo_npz

    @property
    def cbcb(self):
        return self.geo["cbcb"]

    @property
    def omega(self):
        return self.geo["omega"]

    @property
    def theta(self):
        return self.geo["theta"]

    @property
    def phi(self):
        return self.geo["phi"]


class VonMises1D:
    def __init__(self, mu, sigma):
        self.mu = mu
        self.sigma = sigma

    def log_prob(self, x):
        z = math.log(1.0 / (math.sqrt(2 * math.pi) * self.sigma))
        return z + (torch.cos(x - self.mu) - 1) / (self.sigma ** 2)


class BondRestraint(nn.Module):
    def __init__(self, sigma):
        super().__init__()
        self.sigma = sigma

    def gaussian_loss(self, x, mean):
        m = torch.distributions.normal.Normal(mean, self.sigma)
        return -torch.sum(m.log_prob(x))

    def circular_gaussian_loss(self, x, mean):
        m = VonMises1D(mean, self.sigma)
        return -torch.sum(m.log_prob(x))

    def bond_length_restraint(self, coord):
        N, C = coord.N, coord.C
        C_N = self.gaussian_loss(distance(C[:, :-1], N[:, 1:]), constants.L_C_N)
        return C_N

    def bond_angle_restraint(self, coord):
        N, CA, C = coord.N, coord.CA, coord.C
        CA_C_N = self.gaussian_loss(
            calc_angle(CA[:, :-1], C[:, :-1], N[:, 1:])[-1], constants.A_CA_C_N
        )
        C_N_CA = self.gaussian_loss(
            calc_angle(C[:, :-1], N[:, 1:], CA[:, 1:])[-1], constants.A_C_N_CA
        )
        omega = self.circular_gaussian_loss(
            calc_dihedral(CA[:, :-1], C[:, :-1], N[:, 1:], CA[:, 1:])[-1],
            constants.OMEGA,
        )
        return CA_C_N + C_N_CA + omega

    def forward(self, coord):
        return {
            "bond_length": self.bond_length_restraint(coord),
            "bond_angle": self.bond_angle_restraint(coord),
        }

class Coordinates:
    def __init__(self, N, CA, C, CB):
        """
        shape: (B, L, 3)
        """
        self.C = C
        self.N = N
        self.CA = CA
        self.CB = CB


class ResiduePose(nn.Module):
    def __init__(self, translation, quaternion=None):
        """
        shape: (B, L, 3)
        """
        super().__init__()
        B, L = translation.shape[:2]
        self.translation = nn.Parameter(translation, requires_grad=True)
        self.quaternion = nn.Parameter(quaternion, requires_grad=True)

    def normalize(self):
        with torch.no_grad():
            center = torch.mean(self.translation, dim=1, keepdims=True)
            self.translation -= center
            norm = torch.norm(self.quaternion, 2, dim=-1).unsqueeze(-1)
            self.quaternion /= norm + 1e-6

    def to_coord(self):
        self.normalize()
        device = self.translation.device
        R = torch.zeros(*self.quaternion.shape[:-1], 3, 3, device=device)
        r = self.quaternion[..., 0]
        i = self.quaternion[..., 1]
        j = self.quaternion[..., 2]
        k = self.quaternion[..., 3]
        R[..., 0, 0] = 1 - 2 * (j**2 + k**2)
        R[..., 0, 1] = 2 * (i * j - k * r)
        R[..., 0, 2] = 2 * (i * k + j * r)
        R[..., 1, 0] = 2 * (i * j + k * r)
        R[..., 1, 1] = 1 - 2 * (i**2 + k**2)
        R[..., 1, 2] = 2 * (j * k - i * r)
        R[..., 2, 0] = 2 * (i * k - j * r)
        R[..., 2, 1] = 2 * (j * k + i * r)
        R[..., 2, 2] = 1 - 2 * (i**2 + j**2)
        internal_coord = {
            "N": [1.460091, 0.0, 0.0],
            "CA": [0.0, 0.0, 0.0],
            "C": [-0.56431316, 1.41695817, 0.0],
            "CB": [-0.52426314, -0.76611338, 1.20561194],
        }
        d = type('coordinate', (), {})()
        for key in ["N", "CA", "C", "CB"]:
            pos = torch.tensor(internal_coord[key], device=device)
            d.__dict__[key] = (torch.matmul(R, pos) + self.translation)
        return d


class BackBoneModel(nn.Module):
    def __init__(self, pred_dist=None, pred_omega=None, pred_theta=None, pred_phi=None, bond_sigma=0.1):
        super(BackBoneModel, self).__init__()
        self.bond_r = BondRestraint(sigma=bond_sigma)
        self.dist_r = DistanceRestraint(pred_dist)
        self.omega_r = OmegaRestraint(pred_omega)
        self.theta_r = ThetaRestraint(pred_theta)
        self.phi_r = PhiRestraint(pred_phi)
        self.weights = defaultdict(lambda: 1)
    #
    def forward(self, pose, use_distance=True, use_orientation=True):
        coord = pose.to_coord()
        losses = {}
        if use_distance:
            losses.update(self.dist_r(coord))
        if use_orientation:
            losses.update(self.omega_r(coord))
            losses.update(self.theta_r(coord))
            losses.update(self.phi_r(coord))
        losses.update(self.bond_r(coord))
        for k, v in losses.items():
            losses[k] = v * self.weights[k]
        return losses

    def set_bond_sigma(self, sigma):
        self.bond_r.sigma = sigma

    def set_weight(self, key, value):
        self.weights[key] = value

    def clear_weight(self):
        self.weights = defaultdict(lambda: 1.0)

    def set_default_weight(self):
        self.clear_weight()
        self.set_weight("cbcb_distance", 5.0)
        self.set_weight("pairwise_omega", 1.0)
        self.set_weight("pairwise_theta", 1.0)
        self.set_weight("pairwise_phi", 1.0)



def closure(optimizer, pose, model, log_prefix, **kargs):
    optimizer.zero_grad()
    B = pose.translation.shape[0]
    losses = model(pose, **kargs)
    loss_str = ", ".join(
        ["%s: %.6f" % (k, v.item() / B) for k, v in losses.items()])
    logging.debug("%s %s", log_prefix, loss_str)
    loss = sum(losses.values())
    loss.backward()
    return loss


def optimize_topo(model,
                  pose,
                  cur_iter,
                  nr_step=100,
                  warmup=10,
                  init_lr=1,
                  minimal_lr=1e-3,
                  init_sigma=1,
                  minimal_sigma=0.1):

    optimizer = torch.optim.Adam(pose.parameters(), lr=init_lr)

    for step in range(nr_step):
        cur_lr = cosine_schedule(
            init_value=init_lr, cur_step=step, nr_step=nr_step,
            warmup=warmup) + minimal_lr
        for g in optimizer.param_groups:
            g["lr"] = cur_lr
        cur_sigma = cosine_schedule(init_value=init_sigma,
                                    cur_step=step,
                                    nr_step=nr_step) + minimal_sigma
        model.set_bond_sigma(cur_sigma)
        optimizer.step(
            functools.partial(
                closure,
                optimizer=optimizer,
                model=model,
                pose=pose,
                log_prefix=f"Iter: {cur_iter}, Step: [{step}/{nr_step}],"))


class Task:
    def __init__(self,
                 fasta,
                 prediction,
                 n_structs,
                 pool_size,
                 device):
        self.name = "dssp"
        self.seq = fasta
        self.L = len(self.seq)

        self.model = BackBoneModel(
            pred_dist=prediction.cbcb,
            pred_omega=prediction.omega,
            pred_theta=prediction.theta,
            pred_phi=prediction.phi,
        ).to(device)
        logging.info(str(self.model))
        self.model.set_default_weight()

        self.n_structs = n_structs
        self.device = device

        self.pool = [None] * pool_size
        self.score = [None] * pool_size
        self.n_iter = [None] * pool_size
        self.n_finished = 0

    def init_logger(self, path):
        logging.getLogger().setLevel(logging.DEBUG)
        fd = logging.FileHandler(path)
        logging.getLogger().addHandler(fd)
        logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))

    def start(self):
        cur_iter = 0
        while self.n_finished < self.n_structs:
            cur_iter += 1
            self.before_iteration()
            poses = self.get_poses()
            optimize_topo(
                self.model,
                poses,
                cur_iter
            )
            self.after_iteration(poses)
            del poses
        return self.result

    def before_iteration(self):

        z = self.L**(1.0 / 3) * 4
        for i in range(len(self.pool)):
            if self.pool[i] is None:
                rand_x = torch.rand(self.L, 3) * z
                rand_y = 2 * torch.rand(self.L, 4) - 1
                self.pool[i] = (rand_x.to(self.device), rand_y.to(self.device))
                self.score[i] = None
                self.n_iter[i] = 0
                logging.info(f"Pool {i} generate new structure.")

    def get_poses(self):
        x = torch.stack([_[0] for _ in self.pool])
        y = torch.stack([_[1] for _ in self.pool])
        return ResiduePose(x, y)

    def score_it(self, translation, quaternion):
        with torch.no_grad():
            x = ResiduePose(translation[None], quaternion[None])
            score = self.model(x)
            del x
        return score

    def after_iteration(self, poses):
        with torch.no_grad():
            translation = poses.translation.data
            quaternion = poses.quaternion.data
            for i in range(len(self.pool)):
                item = (translation[i], quaternion[i])
                score = self.score_it(*item)
                s_score = sum(score.values()).item()
                score_str = ", ".join(
                    ["%s: %f" % (k, v.item()) for k, v in score.items()])
                score_str += f", Total: {s_score}"
                logging.info(f"Pool {i} score, {score_str}")
                if self.n_iter[i] > 0 and self.score[i] * 1.001 < s_score:
                    logging.info(
                        f"Pool {i} auto converge at iteration {self.n_iter[i]}. "
                    )
                    result = self.save_decoy(*self.pool[i], info=score_str)
                    self.pool[i] = None
                    return result
                else:
                    self.pool[i] = item
                    self.score[i] = s_score
                    self.n_iter[i] += 1

    def save_decoy(self, translation, quaternion, info=None):
        self.n_finished += 1
        pose = ResiduePose(translation[None], quaternion[None])
        coord = pose.to_coord()
        self.result = coord


class OmegaRestraint(nn.Module):
    """Omega angle is defined as dehidral (CA_i, CB_i, CB_j, CA_j)"""

    def __init__(self, pred_omega):
        """
        pred_omega has shape (L, L, 37)
        """
        super().__init__()
        L = pred_omega.shape[0]
        _filter = torch.tensor(pred_omega[:, :, -1] < config.OMEGA_CUT)
        self.mask = nn.Parameter(
            torch.triu(torch.ones((L, L)).bool(), diagonal=1).__and__(_filter),
            requires_grad=False,
        )

        _step = 15.0 * math.pi / 180.0
        self.cutoffs = torch.linspace(-math.pi + 0.5 * _step, math.pi + 0.5 * _step, steps=25)
        _x = self.cutoffs
        _ref = -np.log(constants.bg_omega)
        _y = -np.log(pred_omega[:, :, :-1] + EPS) - _ref

        _y = np.concatenate([_y, _y[:, :, :1]], axis=-1)
        self.coeff = nn.Parameter(cubic_spline(_x, _y, period=True), requires_grad=False)
        self.cutoffs = nn.Parameter(self.cutoffs, requires_grad=False)

    def __str__(self):
        return "Omega constraints: %i" % torch.sum(self.mask).item()

    def forward(self, coord):
        B = coord.CA.shape[0]
        x_idx, y_idx = torch.where(self.mask)
        x_CA = coord.CA[:, x_idx].view(-1, 3)
        x_CB = coord.CB[:, x_idx].view(-1, 3)
        y_CA = coord.CA[:, y_idx].view(-1, 3)
        y_CB = coord.CB[:, y_idx].view(-1, 3)
        x_idx, y_idx = x_idx.repeat(B), y_idx.repeat(B)
        x_idx, y_idx, omega = calc_dihedral(x_CA, x_CB, y_CB, y_CA, x_idx, y_idx)

        coeff = self.coeff[x_idx, y_idx]
        omega_potential = torch.sum(evaluate(coeff, self.cutoffs, omega))

        return {
            "pairwise_omega": omega_potential,
            # "pairwise_omega": omega,
        }


class ThetaRestraint(nn.Module):
    """Theta angle is defined as dehidral (N_i, CA_i, CB_i, CB_j)"""

    def __init__(self, pred_theta):
        """
        pred_theta has shape (L, L, 37)
        """
        super().__init__()
        L = pred_theta.shape[0]
        _filter = torch.tensor(pred_theta[:, :, -1] < config.THETA_CUT)
        self.mask = nn.Parameter(
            (torch.eye(pred_theta.shape[0]) == 0).__and__(_filter),
            requires_grad=False,
        )

        _step = 15.0 * math.pi / 180.0
        self.cutoffs = torch.linspace(-math.pi + 0.5 * _step, math.pi + 0.5 * _step, steps=25)
        _x = self.cutoffs
        _ref = -np.log(constants.bg_theta)
        _y = -np.log(pred_theta[:, :, :-1] + EPS) - _ref
        _y = np.concatenate([_y, _y[:, :, :1]], axis=-1)
        self.coeff = nn.Parameter(cubic_spline(_x, _y, period=True), requires_grad=False)
        self.cutoffs = nn.Parameter(self.cutoffs, requires_grad=False)

    def __str__(self):
        return "Theta constraints: %i" % torch.sum(self.mask).item()

    def forward(self, coord):
        B = coord.CA.shape[0]
        x_idx, y_idx = torch.where(self.mask)
        x_N = coord.N[:, x_idx].view(-1, 3)
        x_CA = coord.CA[:, x_idx].view(-1, 3)
        x_CB = coord.CB[:, x_idx].view(-1, 3)
        y_CB = coord.CB[:, y_idx].view(-1, 3)
        x_idx, y_idx = x_idx.repeat(B), y_idx.repeat(B)
        x_idx, y_idx, theta = calc_dihedral(x_N, x_CA, x_CB, y_CB, x_idx, y_idx)

        coeff = self.coeff[x_idx, y_idx]
        theta_potential = torch.sum(evaluate(coeff, self.cutoffs, theta))

        return {
            "pairwise_theta": theta_potential,
            # "pairwise_theta": theta,
        }


class PhiRestraint(nn.Module):
    def __init__(self, pred_phi):
        super().__init__()
        step = 15.0 * math.pi / 180.0
        self.cutoffs = torch.linspace(-1.5 * step, np.pi + 1.5 * step, steps=12 + 4)
        _x = self.cutoffs.numpy().tolist()
        _ref = -np.log(constants.bg_phi)
        _y = -np.log(pred_phi[:, :, :-1] + EPS) - _ref
        _y = np.concatenate([np.flip(_y[:, :, :2], axis=-1), _y, np.flip(_y[:, :, -2:], axis=-1)], axis=-1)
        self.coeff = nn.Parameter(cubic_spline(_x, _y), requires_grad=False)
        _filter = torch.tensor(pred_phi[:, :, -1] < config.PHI_CUT)
        self.mask = nn.Parameter(
            (torch.eye(pred_phi.shape[0]) == 0).__and__(_filter),
            requires_grad=False,
        )
        self.cutoffs = nn.Parameter(self.cutoffs, requires_grad=False)

    def __str__(self):
        return "Phi constraints: %i" % torch.sum(self.mask).item()

    def forward(self, coord):
        B = coord.CA.shape[0]
        x_idx, y_idx = torch.where(self.mask)
        x_CA = coord.CA[:, x_idx].view(-1, 3)
        x_CB = coord.CB[:, x_idx].view(-1, 3)
        y_CB = coord.CB[:, y_idx].view(-1, 3)
        x_idx, y_idx = x_idx.repeat(B), y_idx.repeat(B)
        x_idx, y_idx, phi = calc_angle(x_CA, x_CB, y_CB, x_idx, y_idx)

        coeff = self.coeff[x_idx, y_idx]
        phi_potential = torch.sum(evaluate(coeff, self.cutoffs, phi))

        return {
            "pairwise_phi": phi_potential,
            # "pairwise_phi": phi,
        }


_aa_1_3_dict = {
    'A': 'ALA',
    'C': 'CYS',
    'D': 'ASP',
    'E': 'GLU',
    'F': 'PHE',
    'G': 'GLY',
    'H': 'HIS',
    'I': 'ILE',
    'K': 'LYS',
    'L': 'LEU',
    'M': 'MET',
    'N': 'ASN',
    'P': 'PRO',
    'Q': 'GLN',
    'R': 'ARG',
    'S': 'SER',
    'T': 'THR',
    'V': 'VAL',
    'W': 'TRP',
    'Y': 'TYR',
    '-': 'GAP'
}

_aa_3_1_dict = {v: k for k, v in _aa_1_3_dict.items()}


def parse_pdb(lines):
    N = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "N"])
    Ca = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "CA"])
    C = np.array([[float(l[6]), float(l[7]), float(l[8])] for l in lines if l[2].strip() == "C"])
    xyz = np.stack([N, Ca, C], axis=0)
    # indices of residues observed in the structure

    idx = np.array([l[5] for l in lines if l[2].strip() == "CA"])
    return xyz, idx


def norm_fun(x, mu, sigma):
    pdf = np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (sigma * np.sqrt(2 * np.pi))
    return pdf


def mtx2bins(x_ref, start, end, nbins):
    if nbins == 37:
        bin_set = []
        bins = np.array([0] + np.linspace(2.5, 20, num=36).tolist(), dtype=np.float32)
        for i in range(len(bins)):
            result = np.random.normal(i + 1, 7, 1000)  # 均值为0.5,方差为1
            x = np.arange(0, nbins)
            y = norm_fun(x, result.mean(), result.std())
            bin_set.append(y)
        bin_set = np.array(bin_set)

        x_true = np.digitize(x_ref, bins).astype(np.uint8) - 1
        x_true = bin_set[x_true]
        return x_true
    else:
        bin_set = []
        bins = np.linspace(start, end, nbins)
        for i in range(len(bins)):
            result = np.random.normal(i + 1, 7, 1000)  # 均值为0.5,方差为1
            x = np.arange(0, nbins)
            y = norm_fun(x, result.mean(), result.std())
            bin_set.append(y)
        bin_set = np.array(bin_set)

        x_true = np.digitize(x_ref, bins).astype(np.uint8) - 1
        x_true = bin_set[x_true]
        return x_true


def extend(a, b, c, L, A, D):
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    bc = N(b - c)
    n = N(np.cross(b - a, bc))
    m = [bc, np.cross(n, bc), n]
    d = [L * np.cos(A), L * np.sin(A) * np.cos(D), -L * np.sin(A) * np.sin(D)]
    return c + sum([m * d for m, d in zip(m, d)])


def to_len(a_coords, b_coords, exp_shape=None):
    a_coords = torch.tensor(a_coords)
    b_coords = torch.tensor(b_coords)

    dist_mat = (a_coords - b_coords).norm(dim=-1)
    dist_mat = dist_mat.detach().numpy()

    return dist_mat


def to_dih(a, b, c, d):
    D = lambda x, y: np.sum(x * y, axis=-1)
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    bc = N(b - c)
    n1 = np.cross(N(a - b), bc)
    n2 = np.cross(bc, N(c - d))
    return np.arctan2(D(np.cross(n1, bc), n2), D(n1, n2))


def to_ang(a, b, c):
    D = lambda x, y: np.sum(x * y, axis=-1)
    N = lambda x: x / np.sqrt(np.square(x).sum(-1, keepdims=True) + 1e-8)
    return np.arccos(D(N(b - a), N(b - c)))


def get_structure_info(pdb=None):
    assert pdb != None
    (N, CA, C), idx = parse_pdb(lines=pdb)
    CB = extend(C, N, CA, 1.522, 1.927, -2.143)
    dist_ref = to_len(CB[:, None], CB[None, :])
    omega_ref = to_dih(CA[:, None], CB[:, None], CB[None, :], CA[None, :])
    theta_ref = to_dih(N[:, None], CA[:, None], CB[:, None], CB[None, :])
    phi_ref = to_ang(CA[:, None], CB[:, None], CB[None, :])

    p_dist = mtx2bins(dist_ref, 2.5, 20.0, 37)
    p_omega = mtx2bins(omega_ref, -np.pi, np.pi, 25)
    p_theta = mtx2bins(theta_ref, -np.pi, np.pi, 25)
    p_phi = mtx2bins(phi_ref, 0.0, np.pi, 13)
    npz_dict = dict(cbcb=p_dist, omega=p_omega, theta=p_theta, phi=p_phi)

    return npz_dict


class FastaData(object):

    def __init__(self, pdb):
        self.pdb = pdb.split("\n")
        self.pdb_info = [lines.split() for lines in self.pdb if lines.startswith("ATOM")]
        self.pdb_info = [lines for lines in self.pdb_info]

    def get_fasta(self):
        res_name = [_aa_3_1_dict[i[3]] for i in self.pdb_info if i[2].upper() == "CA"]
        fasta = "".join(res_name)
        return fasta


def get_ffd_from_numbers(pdb, nums, n_structs, pool_size, device):
    # 从pdb中提取拖动的残基
    pdb_dt = pdb.split("\n")
    pdb_cg = []
    pdb_bf = []
    pdb_af = []

    for res in pdb_dt:
        if res.startswith("ATOM"):
            line = res.split()
            if int(line[5]) in nums:
                if line[2] in ["N", "CA", "C", "O", "CB"]:
                    pdb_cg.append(res)
                pass
            elif int(line[5]) < nums[0]:
                pdb_bf.append(res)
            else:
                pdb_af.append(res)

    pdb_cg_str = "\n".join(pdb_cg)

    # 从pdb中获取fasta
    fasta_data = FastaData(pdb_cg_str)
    fasta = fasta_data.get_fasta()
    print("fasta", fasta)

    # 将 get_structure_info的输出转化为 geo_npz
    geo_npz = get_structure_info(fasta_data.pdb_info)

    if device == -1:
        device = "cpu"
    pred = Prediction(geo_npz)
    if pool_size == -1:
        pool_size = n_structs
    task = Task(fasta=fasta,
                prediction=pred,
                n_structs=n_structs,
                pool_size=pool_size,
                device=device)
    final_data = task.start()
    return final_data.CA[0].detach().cpu().numpy()


if __name__ == '__main__':
    with open("1cbs1.pdb", "r") as fr:
        pdb = "".join([i for i in fr])

    n_structs = 1
    pool_size = -1
    device = -1
    number_a = [53, 54, 55, 56, ]
    start = time.time()
    data = get_ffd_from_numbers(pdb, number_a, n_structs, pool_size, device)
    end = time.time()
    print(end - start)
    print(data.tolist())
