let punctStart = null;


window.pornireInvat = function() {
    console.log("Sistem pornit...");
    afiseazaDataSectiunea1();
    initializareSectiunea2();
};

function afiseazaDataSectiunea1() {
    const d = new Date().toLocaleString("ro-RO");
    const p1 = document.getElementById("data_si_ora");
    const p2 = document.getElementById("locația"); 
    const p3 = document.getElementById("software");

    if (p1) p1.textContent = d;
    if (p2) p2.textContent = window.location.href;
    if (p3) p3.textContent = window.navigator.userAgent;

    if (document.getElementById("data_si_ora")) {
        setTimeout(afiseazaDataSectiunea1, 1000);   
    }
}

function initializareSectiunea2() {
    const myCanvas = document.getElementById("canvasDesen");
    if (!myCanvas) return;

    const ctx = myCanvas.getContext("2d");
    const culoareUmplere = document.getElementById("culoareUmplere");
    const culoareContur = document.getElementById("culoareContur");

    punctStart = null;

    myCanvas.onclick = function(event) {
        const rect = myCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (!punctStart) {
            punctStart = { x: x, y: y };
            const p4 = document.getElementById("canva");
            if (p4) p4.textContent = "Primul punct setat! Apasă în altă parte pentru a termina dreptunghiul.";
        } else {
            const latime = x - punctStart.x;
            const inaltime = y - punctStart.y;

            ctx.fillStyle = culoareUmplere.value;
            ctx.strokeStyle = culoareContur.value;
            ctx.lineWidth = 2;

            ctx.fillRect(punctStart.x, punctStart.y, latime, inaltime);
            ctx.strokeRect(punctStart.x, punctStart.y, latime, inaltime);

            const p4 = document.getElementById("canva");
            if (p4) p4.textContent = "Dreptunghi desenat! Apasă iar pentru unul nou.";

            punctStart = null;
        }
    };
}

function clearCanvas() {
    const canvas = document.getElementById("canvasDesen");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function verificaUtilizator() {
    const userIntrodus = document.getElementById("v_username").value;
    const parolaIntrodusa = document.getElementById("v_parola").value;
    const elementMesaj = document.getElementById("mesaj-verificare"); 

    if (elementMesaj)
    {
        elementMesaj.innerHTML ="";
    }

    if (userIntrodus.trim()==="" || parolaIntrodusa.trim()===""){
        return;
    }


    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            const utilizatori = JSON.parse(this.responseText);
            const gasit = utilizatori.find(u => 
                u.utilizator === userIntrodus && 
                u.parola === parolaIntrodusa);


            if (elementMesaj) {
                if (gasit) {
                    elementMesaj.innerHTML = "Succes: Utilizatorul și parola sunt corecte!";
                    elementMesaj.style.color = "#0e9b60";
                } else {
                    elementMesaj.innerHTML = "Eroare: Date de autentificare invalide.";
                    elementMesaj.style.color = "#e74c3c";
                }
            }
        }
    };
    xhttp.open("GET", "resurse/utilizatori.json", true);
    xhttp.send();
}

function trimiteInregistrare() {
    var form = document.getElementById("form_inregistrare");
    var dateUtilizator = {
        utilizator: form.querySelector('input[placeholder="Nume utilizator"]').value,
        parola: form.querySelector('input[placeholder="Parola"]').value
    };

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                alert("Înregistrare reușită!");
            } else {
                alert("Eroare la server");
            }
        }
    };
    
    xhttp.open("POST", "/api/utilizatori", true);
    xhttp.setRequestHeader("Content-Type", "application/json");
    xhttp.send(JSON.stringify(dateUtilizator));
}

