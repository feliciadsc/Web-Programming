self.onmessage = function(e) {
    const produs = e.data;
    
    console.log("Worker: Am primit produsul - ", produs.nume);

    self.postMessage(produs);
};