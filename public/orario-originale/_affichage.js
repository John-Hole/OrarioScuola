//-----------------------------------------------------
//  Composition pour affichage des publications EDT
//                      ~o~
//  
// Ce fichier javascript est inclu dans les fichiers 
// fichiers html index, professeurs, classes, eleves,
// salles et conseilsdeclasse.
//-----------------------------------------------------

// Compose le bandeau titre de page
function composerBandeauTitre () {
	var strHtml = '';
	
	strHtml += '<table class="marges" width="100%" cellspacing="0" cellpadding="0">';
	strHtml += '  <tr>';
  strHtml += '    <td class="titre emploi">' + titrePage + '</td>';	  		
	strHtml += '    <td class="titre date">' + dateDerniereMaj + '</td>';	
	strHtml += '  </tr>';
	strHtml += '</table>';
  
  var el = document.getElementById ('bandeauPage');
  if (el) el.innerHTML = strHtml;
}; 

//-----------------------------------------------------
// Compose en colonne les genres de ressources publiées
function composerBandeauGenre () {
	var strHtml = '';
	
	strHtml += '<table cellspacing="0" cellpadding="5">';
	strHtml += '  <tr>';
	strHtml += '    <td class="titre recherche">' + libChoixGenre + '</td>';
	for (var i=0; i < listeGenres.length; i++)
	  strHtml += '    <td class="titre genre espaceGauche" onclick="composerBandeauRessource (\'' + listeGenres[i].genre + '\')">' + listeGenres [i].libelle + '</td>'; 
	strHtml += '  </tr>';
	strHtml += '</table>';
	  
  var el = document.getElementById ('bandeauGenre');
  if (el) el.innerHTML = strHtml;
};

//-----------------------------------------------------
// Compose en colonne les ressources publiées
function composerBandeauRessource (aGenre, targetCodage) {
  var j = null; // mémorise indice du premier élément du select
	var strHtml = '';
   
  strHtml += '<table cellspacing="0" cellpadding="5">';	
  strHtml += '  <tr >';	
	strHtml += '    <td class="choix">' + listeChoixRessources[aGenre] + '</td>';
	strHtml += '    <td>';
	strHtml += '      <select id="selectRessource" onchange="composerBandeauPeriode(this.options[selectedIndex].value)">'; 
	for (var i=0; i < listeRessources.length; i++) {	  
	  if (listeRessources[i].genre == aGenre){
      if (j == null)
        j = i;
      var isSelected = (targetCodage && listeRessources[i].codage == targetCodage);
      if (isSelected) {
        j = i;
      }
      strHtml += '<option value="' + listeRessources[i].codage + '"' + (isSelected ? ' selected' : '') + '>' + listeRessources[i].libelle + '</option>';  
    }
  }
  strHtml += '      </select>';
	strHtml += '    </td>';
	strHtml += '  </tr>';
  strHtml += '</table>';
 
  var el = document.getElementById ('bandeauRessource');
  if (el) el.innerHTML = strHtml;
  
  if (j != null) 
    composerBandeauPeriode(listeRessources[j].codage); 
};

//-----------------------------------------------------
// Compose en colonne les ressources publiées
function composerBandeauPeriode (aCle) {
	var j = null; // mémorise indice du premier élément du select
	var strHtml = ''; 
  
  if (aCle != 'vide') { 
    strHtml += '<table cellspacing="0" cellpadding="5">';	
    strHtml += '  <tr>';
    strHtml += '    <td class="choix espaceGauche">' + libChoixPeriodes + '</td>';
    strHtml += '    <td>';
	  strHtml += '        <select onchange="composerGrille(this.options[selectedIndex].value)">';
	  for (var i=0; i < listePeriodes.length; i++) 	   
	    if (listePeriodes[i].cleRess == aCle) {
        if (j == null) 
          j = i;
        strHtml += '<option value="' + listePeriodes[i].codage + '">' + listePeriodes[i].libelle + '</option>'; 
      } // if   
    strHtml += '        </select>';
    strHtml += '    </td>';
    strHtml += '  </tr>';
    strHtml += '</table>';
	}
	  
	// Attention !
	// pas d'affichage d'un choix de période
	// pour les sessions de conseils de classe
	if (j != null)
	  for (var i=0; i < listeRessources.length; i++) 	  
	    if (listeRessources[i].codage == aCle)
	      if (listeRessources[i].genre == 'grSession')
    	    strHtml = '';	
	
	var el = document.getElementById ('bandeauPeriode');
  if (el) el.innerHTML = strHtml;
  
  if (j != null)
    composerGrille(listePeriodes[j].codage);
	else if (aCle == 'vide')
		composerGrille(aCle);    
};

//-----------------------------------------------------
// Compose en colonne les grilles et renvois associés
function composerGrille (aCle) {
	var genrePub = '';
	var strHtml = '';  
  
  if (aCle != 'vide') { 
    for (var i=0; i < listeGrilles.length; i++) 	  
	    if (listeGrilles[i].cleGrille == aCle) {
        genrePub = listeGrilles[i].genre; 
        var nomFichier = listeGrilles[i].nomFichier;
        var remoteFallback = 'https://cspace.spaggiari.eu/pub/PGIT0005/orario/' + nomFichier;
               
        strHtml += '<table class="marges grille-table" cellspacing="0" cellpadding="0">';	
        strHtml += '  <tr>';
        strHtml += '    <td><img id="imgGrilleOrario" src="' + nomFichier + '" onerror="if(!this.dataset.fallback){this.dataset.fallback=\'1\';this.src=\'' + remoteFallback + '\';}" alt="Orario scolastico"></img></td>';
        strHtml += '  </tr>';
        if (listeGrilles[i].renvois.length > 0) 
          for (var j=0; j < listeGrilles[i].renvois.length; j++) {	          
            strHtml += '  <tr>';
            strHtml += '    <td>';     
            strHtml += '      <table style="font-family:' + listeGrilles[i].renvois[j].police.nom + '; font-size:' + listeGrilles[i].renvois[j].police.taille + 'pt" cellspacing="0" cellpadding="5">';
            strHtml += '        <tr>';
	          strHtml += '          <td class="titreRenvoi" colspan="2">' + listeGrilles[i].renvois[j].titre + '</td>'; 
	          strHtml += '        </tr>';
	          
	          if (listeGrilles[i].renvois[j].lignes.length > 0) 
	            for (var k=0; k < listeGrilles[i].renvois[j].lignes.length; k++) {
	          	  strHtml += '<tr>';       
	          	  strHtml += '  <td class="centrer">(' + listeGrilles[i].renvois[j].lignes[k].numero + ')</td>';      
	          	  strHtml += '  <td>' + listeGrilles[i].renvois[j].lignes[k].texte + '</td>';         
	          	  strHtml += '</tr>';
	            } // for k
            
            strHtml += '      </table>';               
            strHtml += '    </td>';       
  	        strHtml += '  </tr>';
  	      } // for j 
        
        strHtml += '</table>';        
        if (listeGrilles[i].genre != 'grSession') // à supprimer à terme
          break;                                  // à supprimer à terme
      } // if->for 
	}      
 
  var elGrille = document.getElementById ('grille');
  if (elGrille) elGrille.innerHTML = strHtml;
  
  composerSignature (aCle, genrePub);
};

//-----------------------------------------------------
// Compose en colonne les grilles et renvois associés
function composerSignature (aCle, aGenre) {
	var strHtml = ''; 

  if (aCle != 'vide') { 
    strHtml += '<P>&nbsp;</P>';	
    strHtml += '<p class="signature">' + (listeSignature[aGenre] || 'ORARIO DEFINITIVO PERIODO COMPLETO'); 
    strHtml += ' - &copy; <a href="' + SigUrlSite + '" title="' + SigUrlTitre + '" target="_blank" rel="noopener">';
    strHtml += 'INDEX-EDUCATION</a>&nbsp;' + SigIdxEditeur + '</p>';  
    strHtml += '<br>';         
	}      
 
  var elSig = document.getElementById ('signature');
  if (elSig) elSig.innerHTML = strHtml;
};

// Trova il codice per la classe specificata (default: 4 BINF, c0000119)
function trovaCodiceClasse(nomeTarget) {
  var raw = (nomeTarget || '4 BINF').replace(/[\s\-_]+/g, '').toUpperCase();
  for (var i = 0; i < listeRessources.length; i++) {
    if (listeRessources[i].genre === 'grClasse') {
      var normLib = listeRessources[i].libelle.replace(/[\s\-_]+/g, '').toUpperCase();
      if (normLib === raw || normLib.indexOf(raw) !== -1 || raw.indexOf(normLib) !== -1) {
        return listeRessources[i].codage;
      }
    }
  }
  return 'c0000119'; // Default garantito per 4 BINF
}

//-----------------------------------------------------
// main !
function AfficherPage () {
	composerBandeauTitre ();
	composerBandeauGenre ();
  
  var targetClass = '4 BINF';
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.has('classe') && params.get('classe').trim()) {
      targetClass = params.get('classe').trim();
    }
  } catch (e) {}

  var targetCode = trovaCodiceClasse(targetClass);
  // Preimposta la scheda CLASSI e seleziona 4 BINF
  composerBandeauRessource('grClasse', targetCode);
};
