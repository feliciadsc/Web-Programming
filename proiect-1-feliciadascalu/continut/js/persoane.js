function incarcaPersoane() 
{
    var xhttp = new XMLHttpRequest(); 

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) 
        {
            var xmlDoc = this.responseXML;

            if (!xmlDoc || xmlDoc.getElementsByTagName("parsererror").length > 0) 
            {
                var parser = new DOMParser();
                xmlDoc = parser.parseFromString(this.responseText, "text/xml");
            }

            var persoane = xmlDoc.getElementsByTagName("persoana");

            var tabelHTML = "<table class='tabel-persoane-stilizat'>";
            tabelHTML += `
                <thead>
                    <tr>    
                        <th>Nume</th>
                        <th>Prenume</th>
                        <th>Vârstă</th>
                        <th>Localitate</th>
                    </tr>
                </thead>
                <tbody>`;


            for (var i = 0; i < persoane.length; i++) 
            {  
                var nume = persoane[i].getElementsByTagName("nume")[0]?.textContent || "";
                var prenume = persoane[i].getElementsByTagName("prenume")[0]?.textContent || "";
                var varsta = persoane[i].getElementsByTagName("varsta")[0]?.textContent || "";
                var adresaNod = persoane[i].getElementsByTagName("adresa")[0];
                var localitate = adresaNod?.getElementsByTagName("localitate")[0]?.textContent || "";

                tabelHTML += "<tr>" +
                    "<td>" + nume + "</td>" +
                    "<td>" + prenume + "</td>" +
                    "<td>" + varsta + "</td>" +
                    "<td>" + localitate + "</td>" +
                    "</tr>";
            }

            tabelHTML += "</tbody></table>";
            
            var zonaTabel = document.getElementById("zona-tabel");
            if (zonaTabel) {
                zonaTabel.innerHTML = tabelHTML;
            }
        }
    };
    
    xhttp.open("GET", "resurse/persoane.xml", true);
    xhttp.send();
}