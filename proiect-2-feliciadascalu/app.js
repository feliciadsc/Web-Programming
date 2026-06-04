const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser=require('cookie-parser');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const sqlite3 = require('sqlite3').verbose();

const app = express();

const port = 6789;

const fs = require('fs').promises;

app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(session({
    secret: 'cheie-secreta-proiect', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,  
        secure: false,    
        sameSite: 'strict' 
    }
}));

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

const incercariEsuate = {};
const DURATE_BLOCARE = [60, 300, 900, 1800]; 
const LIMITA_INCERCARI = 5;
 
function getBlockDuration(nrBlocari) {
    const index = Math.min(nrBlocari - 1, DURATE_BLOCARE.length - 1);
    return DURATE_BLOCARE[index];
}
 
function esteBlockat(cheie) {
    const intrare = incercariEsuate[cheie];
    if (!intrare || !intrare.blocatPana) return false;
 
    if (Date.now() < intrare.blocatPana) return true;
 
    delete incercariEsuate[cheie];
    return false;
}
 
function inregistreazaEsec(cheie) {
    if (!incercariEsuate[cheie]) {
        incercariEsuate[cheie] = { count: 0, blocatPana: null, nrBlocari: 0 };
    }
 
    incercariEsuate[cheie].count++;
 
    if (incercariEsuate[cheie].count >= LIMITA_INCERCARI) {
        incercariEsuate[cheie].nrBlocari++;
        const durata = getBlockDuration(incercariEsuate[cheie].nrBlocari);
        incercariEsuate[cheie].blocatPana = Date.now() + durata * 1000;
        incercariEsuate[cheie].count = 0;
        console.log(`[BLOCAT] ${cheie} blocat pentru ${durata} secunde.`);
        return { blocat: true, durata, blocatPana: incercariEsuate[cheie].blocatPana };
    }
 
    const ramase = LIMITA_INCERCARI - incercariEsuate[cheie].count;
    return { blocat: false, ramase };
}
 
function reseteazaEsecuri(cheie) {
    delete incercariEsuate[cheie];
}


const erori404 = {};
const LIMITA_404 = 5;               
const INTERVAL_404 = 1 * 60 * 1000; 
const BLOCARE_404 = 30 * 1000;     

function verificaDoS(ip) {
    const acum = Date.now();
 
    if (!erori404[ip]) {
        erori404[ip] = { count: 0, primulRequest: acum, blocatPana: null };
    }
 
    const intrare = erori404[ip];
 
    if (intrare.blocatPana && acum < intrare.blocatPana) {
        const secundeRamase = Math.ceil((intrare.blocatPana - acum) / 1000);
        return { blocat: true, secundeRamase };
    }
 
    if (acum - intrare.primulRequest > INTERVAL_404) {
        erori404[ip] = { count: 0, primulRequest: acum, blocatPana: null };
    }
 
    erori404[ip].count++;
 
    if (erori404[ip].count >= LIMITA_404) {
        erori404[ip].blocatPana = acum + BLOCARE_404;
        console.log(`[DoS] IP ${ip} blocat pentru 30 secunde (${erori404[ip].count} erori 404).`);
        return { blocat: true, secundeRamase: 30 };
    }
 
    return { blocat: false };
}
 
app.use((req, res, next) => {
    const ip = req.ip;
    const intrare = erori404[ip];
    const acum = Date.now();
 
    if (intrare && intrare.blocatPana && acum < intrare.blocatPana) {
        const secundeRamase = Math.ceil((intrare.blocatPana - acum) / 1000); 
        return res.status(429).send(
            `Acces blocat temporar din cauza comportamentului suspect. Încearcă din nou peste ${secundeRamase} secunde.`
        );
    }
 
    next();
});

async function citesteIntrebari() {
    try {
        const dateRaw = await fs.readFile('./intrebari.json', 'utf8');
        return JSON.parse(dateRaw);
    } catch (err) {
        console.error("Eroare la citirea intrebari.json:", err);
        return [];
    }
}

async function citesteUtilizatori() {
    try {
        const dateRaw = await fs.readFile('./utilizatori.json', 'utf8');
        return JSON.parse(dateRaw);
    } catch (err) {
        console.error("Eroare la citirea utilizatori.json:", err);
        return [];
    }
}

app.get('/autentificare', csrfProtection, (req, res) => {
    const eroare = req.cookies.mesajEroare;
    res.clearCookie('mesajEroare');

    const ip = req.ip;
    let blocatPana = null;
 
    const cheieIP = 'ip_' + ip;
    if (esteBlockat(cheieIP)) {
        blocatPana = Math.ceil((incercariEsuate[cheieIP].blocatPana - Date.now()) / 1000);
    }

    res.render('autentificare', { 
        eroare: eroare, 
        csrfToken: req.csrfToken(),
        blocatPana: blocatPana
    });
});

app.get('/admin', verificaAdmin, csrfProtection, (req, res) => {
    res.render('admin', { 
        utilizator: req.session.utilizator, 
        csrfToken: req.csrfToken()
    });
});

async function verificaAdmin(req, res, next) {
    if (!req.session.utilizator) {
        res.cookie('mesajEroare', 'Trebuie să fii autentificat!');
        return res.redirect('/autentificare');
    }

    const utilizatori = await citesteUtilizatori();
    const utilizatorCurent = utilizatori.find(u => u.utilizator === req.session.utilizator);

    if (utilizatorCurent && utilizatorCurent.rol === 'ADMIN') {
        return next();
    }

    return res.status(403).send('403 Forbidden: Acces exclusiv pentru administratori.');
}

app.post('/admin/adaugare-produs', csrfProtection, verificaAdmin, (req, res) => {
    const nume = req.body.nume;
    const unitate_masura = req.body.unitate_masura;
    const cantitate = parseFloat(req.body.cantitate);
    const pret_unitar = parseFloat(req.body.pret_unitar);

    if (!nume || !unitate_masura || isNaN(cantitate) || isNaN(pret_unitar)) {
        return res.status(400).send("Eroare: Toate câmpurile sunt obligatorii, iar cantitatea și prețul trebuie să fie numere!");
    }

    const db = new sqlite3.Database('cumparaturi.db', (err) => {
        if (err) {
            console.error('Eroare la conectarea la baza de date:', err.message);
            return res.status(500).send('Eroare la conectarea la baza de date');
        }

        const sql = `INSERT INTO produse (nume, unitate_masura, cantitate, pret_unitar) VALUES (?, ?, ?, ?)`;
        
        db.run(sql, [nume, unitate_masura, cantitate, pret_unitar], function(err) {
            db.close();

            if (err) {
                console.error('Eroare la inserarea produsului:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).send('Eroare: Acest produs există deja în baza de date!');
                }
                return res.status(500).send('Eroare la salvarea produsului în baza de date');
            }

            console.log(`[ADMIN] Produs adăugat cu succes! ID: ${this.lastID}`);
            res.redirect('/incarcare-bd');
        });
    });
});

app.post('/verificare-autentificare',
    csrfProtection,
    body('username').trim().escape().notEmpty(),
    body('password').trim().escape().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.cookie('mesajEroare', 'Date invalide!');
            return res.redirect('/autentificare');
        }
 
        const ip = req.ip;
        const utilizator = req.body.username;
        const parola = req.body.password;
 
        const cheieIP   = 'ip_' + ip;
        const cheieUser = 'user_' + utilizator;
 
        if (esteBlockat(cheieIP)) {
            const secundeRamase = Math.ceil((incercariEsuate[cheieIP].blocatPana - Date.now()) / 1000);
            res.cookie('mesajEroare', `IP blocat! Încearcă din nou peste ${secundeRamase} secunde.`);
            return res.redirect('/autentificare');
        }
 
        if (esteBlockat(cheieUser)) {
            const secundeRamase = Math.ceil((incercariEsuate[cheieUser].blocatPana - Date.now()) / 1000);
            res.cookie('mesajEroare', `Contul "${utilizator}" este blocat. Încearcă din nou peste ${secundeRamase} secunde.`);
            return res.redirect('/autentificare');
        }
 
        const utilizatori = await citesteUtilizatori();
        const gasit = utilizatori.find(u => u.utilizator === utilizator);
 
        if (gasit && await bcrypt.compare(parola, gasit.parola)) {
            reseteazaEsecuri(cheieIP);
            reseteazaEsecuri(cheieUser);
            req.session.utilizator = utilizator;
            return res.redirect('/');
        } else {
            const rezultatIP   = inregistreazaEsec(cheieIP);
            const rezultatUser = inregistreazaEsec(cheieUser);
 
            let mesaj;
            if (rezultatIP.blocat) {
                const sec = Math.ceil((incercariEsuate[cheieIP].blocatPana - Date.now()) / 1000);
                mesaj = `Prea multe încercări! IP blocat pentru ${sec} secunde.`;
            } else if (rezultatUser.blocat) {
                const sec = Math.ceil((incercariEsuate[cheieUser].blocatPana - Date.now()) / 1000);
                mesaj = `Contul "${utilizator}" blocat pentru ${sec} secunde.`;
            } else {
                mesaj = `Utilizator sau parolă incorectă! Mai ai ${rezultatIP.ramase} încercări.`;
            }
 
            res.cookie('mesajEroare', mesaj);
            return res.redirect('/autentificare');
        }
    }
);

app.get('/chestionar', csrfProtection, async (req, res) => {
    const utilizatorLogat = req.session.utilizator;

    if (utilizatorLogat) {
        const intrebari = await citesteIntrebari();
        res.render('chestionar', { intrebari: intrebari , utilizator: utilizatorLogat, csrfToken: req.csrfToken() });
    } else {
        res.cookie('mesajEroare', 'Trebuie să fii autentificat pentru a vedea chestionarul!');
        res.redirect('/autentificare');
    }
});

app.post('/rezultat-chestionar', csrfProtection, async (req, res) => {
    const intrebari = await citesteIntrebari();
    let scor = 0;

    intrebari.forEach((intrebare, index) => {
        const raspunsUtilizator = req.body['raspuns' + index];
        
        if (intrebare.tip === 'checkbox') {
            const raspunsuriBifate = raspunsUtilizator || [];
            
            const raspunsuriNumere = Array.isArray(raspunsuriBifate) 
                ? raspunsuriBifate.map(Number) 
                : [Number(raspunsuriBifate)];

            const esteCorect = intrebare.corect.length === raspunsuriNumere.length &&
                intrebare.corect.every(val => raspunsuriNumere.includes(val));

            if (esteCorect) {
                scor++;
            }
        } else {
            if (raspunsUtilizator !== undefined && raspunsUtilizator == intrebare.corect) {
                scor++;
            }
        }
    });

    res.render('rezultat-chestionar', {
        scor: scor,
        intrebari: intrebari,
        raspunsuriTrimise: req.body
    });
});

app.get('/logout', (req, res) => {
    if (!req.session.utilizator) {
        res.cookie('mesajEroare', 'Trebuie să fii autentificat pentru a te deconecta!');
        return res.redirect('/autentificare');
    }
    req.session.destroy((err) => {
        if (err) {
            console.error('Eroare la distrugerea sesiunii:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('/creare-bd', (req, res) => {
    const db = new sqlite3.Database('cumparaturi.db');

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS produse (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nume TEXT UNIQUE,
            unitate_masura TEXT,
            cantitate REAL,
            pret_unitar REAL
        )`, (err) => {
            if (err) {
                console.error("Eroare la crearea tabelului:", err.message);
                return res.status(500).send("Eroare la crearea tabelului.");
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
            return res.send("Eroare la închiderea bazei de date.");
        }
        res.redirect('/');
    });
});

app.get('/incarcare-bd', async (req, res) => {
    const db = new sqlite3.Database('cumparaturi.db');
    const sql = `SELECT * FROM produse`;
    const utilizatorLogat = req.session.utilizator;

    let obiectUtilizator = null;
    if (utilizatorLogat) {
        const utilizatori = await citesteUtilizatori();
        const gasit = utilizatori.find(u => u.utilizator === utilizatorLogat);
        if (gasit) {
            obiectUtilizator = { nume: gasit.utilizator, rol: gasit.rol };
        }
    }

    db.all(sql, [], (err, rows) => {
        db.close();

        if (err) {
            console.error("Eroare la citirea din baza de date:", err.message);
            return res.status(500).send("Eroare la încărcarea datelor.");
        }
        res.render('index', { 
            produse: rows, 
            utilizator: obiectUtilizator 
        });
    });
});

app.get('/', async (req, res) => {
    const db = new sqlite3.Database('cumparaturi.db');
    const utilizatorLogat = req.session.utilizator;
    let obiectUtilizator = null;

    if (utilizatorLogat) {
        const utilizatori = await citesteUtilizatori();
        const gasit = utilizatori.find(u => u.utilizator === utilizatorLogat);
        if (gasit) {
            obiectUtilizator = {
                nume: gasit.utilizator,
                rol: gasit.rol
            };
        }
    }

    db.all("SELECT * FROM produse", [], (err, produse) => {
        db.close();
        if (err) {
            console.error(err.message);
            return res.status(500).send("Eroare la recuperarea produselor.");
        }

        res.render('index', { 
            produse: produse, 
            utilizator: obiectUtilizator 
        });
    });
});

app.post('/adaugare_cos', (req, res) => {
    if (!req.session.utilizator) {
        return res.status(403).send("Trebuie să fii autentificat!");
    }

    if (!req.session.cos) {
        req.session.cos = [];
    }

    const idProdus = parseInt(req.body.id, 10);

    if (!isNaN(idProdus)) {
        req.session.cos.push(idProdus);
        console.log(`Produsul cu ID ${idProdus} a fost adăugat în coș. Coș curent:`, req.session.cos);
    } else {
        console.error("ID-ul produsului primit nu este un număr valid:", req.body.id);
    }

    res.redirect('/');
});

app.get('/vizualizare-cos', (req, res) => {
    let idsInCos = req.session.cos || [];

    if (idsInCos.length === 0) {
        return res.render('vizualizare-cos', { produseInCos: [], utilizator: req.session.utilizator });
    }

    idsInCos = idsInCos.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (idsInCos.length === 0) {
        return res.render('vizualizare-cos', { produseInCos: [], utilizator: req.session.utilizator });
    }

    const db = new sqlite3.Database('cumparaturi.db');

    const placeholders = idsInCos.map(() => '?').join(',');
    const sql = `SELECT * FROM produse WHERE id IN (${placeholders})`;

    db.all(sql, idsInCos, (err, rows) => {
        db.close();
        if (err) {
            console.error('Eroare la recuperarea coșului:', err.message);
            return res.status(500).send("Eroare la server.");
        }
        
        console.log("Produse găsite pentru coș:", rows);

        res.render('vizualizare-cos', { 
            produseInCos: rows, 
            utilizator: req.session.utilizator 
        });
    });
});

app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).send('Token CSRF invalid sau lipsă!');
    }
    next(err);
});


app.use((req, res) => {
    const ip = req.ip;
    console.log(`[404] ${ip} a accesat ${req.url}`);
 
    const rezultat = verificaDoS(ip);
 
    if (rezultat.blocat) {
        return res.status(429).send(
            `Prea multe cereri invalide! Acces blocat pentru ${rezultat.secundeRamase} secunde.`
        );
    }
 
    res.status(404).send(`Pagina "${req.url}" nu există.`);
});

app.listen(port, () => console.log(`Serverul rulează la http://localhost:${port}/`));