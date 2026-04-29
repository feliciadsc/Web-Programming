class Produs 
{
    constructor(id, nume, cantitate) 
    {
        this.id = id;
        this.nume = nume;
        this.cantitate = cantitate;
    }
}

const adaugaInStorage = (produs) => 
{
    return new Promise((resolve, reject) => 
    {
        try 
        {
            let produse = JSON.parse(localStorage.getItem('listaCumparaturi')) || [];
            produse.push(produs);
            localStorage.setItem('listaCumparaturi', JSON.stringify(produse));
            resolve(produse);
        } catch (error) 
        {
            reject("Eroare la salvarea în LocalStorage");
        }
    });
};

const afiseazaProduse = () => {
    const tbody = document.getElementById('lista-produse');
    const produse = JSON.parse(localStorage.getItem('listaCumparaturi')) || [];
    
    const htmlRows = produse.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.nume}</td>
            <td>${p.cantitate}</td>
        </tr>
    `).join('');

    tbody.innerHTML = htmlRows;
};


afiseazaProduse();

const worker = new Worker('js/worker.js');

worker.onmessage = function(e) {
    const produsPrimit = e.data;
    actualizeazaTabelulDirect(produsPrimit);
};

const actualizeazaTabelulDirect = (p) => {
    const tbody = document.getElementById('lista-produse');
    const row = `<tr>
        <td>${p.id}</td>
        <td>${p.nume}</td>
        <td>${p.cantitate}</td>
    </tr>`;
    tbody.innerHTML += row;
};

document.getElementById('btn-adauga').addEventListener('click', () => {
    const nume = document.getElementById('nume').value;
    const cantitate = document.getElementById('cantitate').value;

    if (nume && cantitate) {
        const produseExistente = JSON.parse(localStorage.getItem('listaCumparaturi')) || [];
        const idNou = produseExistente.length + 1;
        const produsNou = new Produs(idNou, nume, cantitate);

        adaugaInStorage(produsNou).then(() => {
            worker.postMessage(produsNou);
            
            document.getElementById('form-cumparaturi').reset();
        });
    } else {
        alert("Completați câmpurile!");
    }
});