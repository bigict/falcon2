// 添加进度条
const geometry = new THREE.BoxGeometry(1, 0.1, 0.1);
const material = new THREE.MeshBasicMaterial({color: 0x0000ff});

const background = new THREE.Mesh(geometry, material);
background.position.set(0, 0, -5);

const foregroundGeometry = new THREE.BoxGeometry(1, 0.1, 0.1);
const foregroundMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
const foreground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
foreground.position.set(0, 0, -5);
foreground.scale.x = 0;  // initialize with no progress

scene.add(background, foreground);

fetch("file_url", {
  method: "GET",
})
.then(response => {
  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');

  let receivedLength = 0; // received that many bytes at the moment
  let chunks = []; // array of received binary chunks (comprises the body)

  reader.read().then(function processChunk({done, value}) {
    if (done) {
      let arr = new Uint8Array(receivedLength); // (4.1)
      let position = 0;
      for(let chunk of chunks) {
        arr.set(chunk, position); // (4.2)
        position += chunk.length;
      }
      // result! Now we have the full body as Uint8Array
      return arr;
    }

    chunks.push(value);
    receivedLength += value.length;
    const progress = receivedLength / contentLength;
    updateProgress(progress);  // Update progress bar

    // Read the next chunk
    return reader.read().then(processChunk);
  });
})
.catch(console.error);
