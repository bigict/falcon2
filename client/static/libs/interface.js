import {df} from './core.js';

df.api = {
    scuba: function (data, selection) {
        let url = "";
        let responseData = fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        }).then(response => {
            return response.json();
        }).then(responseData => {
            // SCUBA 接 ABACUS-R 出结果
            
            return responseData;
        }).catch(error => {
            console.error('Docking fetch Error:', error);
        });
        console.log("responseData", responseData);
    },

}