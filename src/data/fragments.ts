/**
 * Fragments — collection secondaire, quarante-deux pièces.
 *
 * Les textes sont **encodés en base64** et décodés à l'exécution. Ce n'est pas du
 * chiffrement : quiconque ouvre la console obtient tout. C'est un rideau, pas un coffre —
 * mais il suffit à ce que personne ne se fasse gâcher l'histoire en parcourant les sources
 * ou en cherchant un mot-clé dans le bundle.
 *
 * La source de vérité éditoriale est `lore/02-fragments.md`, exclu du dépôt.
 */

export type FragmentType = 'parchemin' | 'sceau' | 'hieroglyphe' | 'pierre';

export interface FragmentDef {
  /** Numéro, de 1 à 42. Affiché en chiffres romains. */
  n: number;
  /** Cycle d'appartenance, 0 à 5. */
  cycle: number;
  type: FragmentType;
  /** Titre encodé. */
  t: string;
  /** Corps encodé. */
  b: string;
}

/**
 * Condition d'apparition d'un cycle. Tant qu'elle n'est pas remplie, les fragments du cycle
 * n'existent pas dans le monde — inutile de les chercher.
 */
export interface CycleDef {
  /** Nom encodé. */
  name: string;
  /** Biome requis, chaîne vide si indifférent. */
  biome: string;
  fromMin: number;
  toMin: number;
  minLevel: number;
  needBoss: boolean;
  /** Nombre de fragments déjà trouvés exigé. */
  minFound: number;
  /** Indice encodé, formulé à la manière de l'Ordre. */
  hint: string;
}

export const TYPE_LABEL: Record<FragmentType, string> = {
  parchemin: 'Parchemin',
  sceau: 'Sceau',
  hieroglyphe: 'Hiéroglyphe',
  pierre: 'Pierre gravée',
};

export const CYCLES: CycleDef[] = [
  { name: 'TGUgRG9tYWluZQ==', biome: 'moor', fromMin: 0, toMin: 10, minLevel: 0, needBoss: false, minFound: 0, hint: 'VW5lIGJvcm5lIGRvcnQgbMOgIG/DuSByaWVuIG5lIHBvdXNzZSwgZMOocyBsYSBwcmVtacOocmUgbWVzdXJlLg==' },
  { name: 'TGVzIEFycGVudGV1cnM=', biome: 'graveyard', fromMin: 3, toMin: 15, minLevel: 0, needBoss: false, minFound: 0, hint: 'VW5lIHRhYmxldHRlIGRvcnQgbMOgIG/DuSBsJ29uIGNvbXB0ZSBsZXMgYWRtaXMsIGFwcsOocyBsYSB0cm9pc2nDqG1lIG1lc3VyZS4=' },
  { name: 'TGEgQ2hhaXIgUsOpw6ljcml0ZQ==', biome: 'mire', fromMin: 6, toMin: 20, minLevel: 10, needBoss: false, minFound: 0, hint: 'VW5lIHRhYmxldHRlIGRvcnQgbMOgIG/DuSBsYSBib3VlIHJldGllbnQsIGFwcsOocyBsYSBzaXhpw6htZSBtZXN1cmUsIHF1YW5kIHZvdXMgcMOoc2VyZXogYXNzZXou' },
  { name: 'TCdPcmRyZSBNdWV0', biome: 'thicket', fromMin: 8, toMin: 22, minLevel: 15, needBoss: false, minFound: 0, hint: 'VW5lIHRhYmxldHRlIGRvcnQgbMOgIG/DuSBsZXMgdHJvbmNzIG5lIHBhcmxlbnQgcGx1cywgYXByw6hzIGxhIGh1aXRpw6htZSBtZXN1cmUsIHF1YW5kIHZvdXMgcMOoc2VyZXogYmVhdWNvdXAu' },
  { name: 'TGEgTWVzdXJl', biome: 'ashes', fromMin: 12, toMin: 26, minLevel: 0, needBoss: true, minFound: 0, hint: 'VW5lIHRhYmxldHRlIGRvcnQgbMOgIG/DuSBsZSBmZXUgYSB0b3V0IHByaXMuIElsIGZhdWRyYSBkJ2Fib3JkIGVuIGFiYXR0cmUgdW4gcXVpIGEgZnJhbmNoaSBsZSBzZXVpbC4=' },
  { name: 'TCdBc2NlbnNpb24=', biome: '', fromMin: 20, toMin: 99, minLevel: 0, needBoss: false, minFound: 30, hint: 'TGVzIHNlcHQgZGVybmnDqHJlcyBuZSBzZSBjYWNoZW50IHBsdXMuIEVsbGVzIGF0dGVuZGVudCwgcGFzc8OpIGxhIHZpbmd0acOobWUgbWVzdXJlLCBjZWx1aSBxdWkgZW4gcG9ydGUgZMOpasOgIHRyZW50ZS4=' },
];

export const FRAGMENTS: FragmentDef[] = [
  { n: 1, cycle: 0, type: 'parchemin', t: 'UmVsZXbDqSBkJ2Fycml2w6ll', b: 'Tm91cyBhdm9ucyBtYXJjaMOpIG9uemUgam91cnMgdmVycyB1biBtdXIgcXVlIGxhIGNhcnRlIG5lIHBvcnRlIHBhcy4gSWwgbid5IGEgcGFzIGRlIG11ci4gSWwgeSBhIHVuIGVuZHJvaXQgb8O5IGxhIGNhcnRlIGNlc3NlIGQnw6p0cmUgdnJhaWUsIGV0IGRlIGwnYXV0cmUgY8O0dMOpLCBsYSBtw6ptZSBsYW5kZSwgcmVmYWl0ZS4=' },
  { n: 2, cycle: 0, type: 'pierre', t: 'Qm9ybmUsIGZhY2Ugbm9yZA==', b: 'UEFSQ0VMTEUgNy4gU291cyBsZSBtb3QsIHVuZSByYW5nw6llIGRlIHRyYWl0cyBxdWUgamUgbmUgc2FpcyBwYXMgbGlyZS4gU291cyBsZXMgdHJhaXRzLCB1bmUgbWFpbiBodW1haW5lIGEgZ3JhdsOpIHBsdXMgdGFyZCwgcGx1cyBwcm9mb25kIDogbmUgY29tcHRleiBwYXMgbGVzIGpvdXJzLg==' },
  { n: 3, cycle: 0, type: 'parchemin', t: 'TGV0dHJlIG5vbiBwb3N0w6ll', b: 'TWEgc8WTdXIsIGxlcyBzdMOobGVzIGR1IGNpbWV0acOocmUgbmUgcG9ydGVudCBwYXMgZGUgbm9tcy4gSidlbiBhaSBmcm90dMOpIHF1YXJhbnRlLiBDZSBzb250IGRlcyBudW3DqXJvcywgZXQgaWxzIG5lIHNlIHN1aXZlbnQgcGFzIGRhbnMgbCdvcmRyZSBvw7kgbCdvbiBtZXVydC4gSWxzIHNlIHN1aXZlbnQgZGFucyBsJ29yZHJlIG/DuSBsJ29uIGVzdCBhZG1pcy4=' },
  { n: 4, cycle: 0, type: 'sceau', t: 'U2NlYXUgZHUgYm9ybmFnZQ==', b: 'VW4gY2VyY2xlIGRpdmlzw6kgZW4gY2lucSBzZWN0ZXVycyBpbsOpZ2F1eC4gQ2hhcXVlIHNlY3RldXIgcG9ydGUgdW4gcGljdG9ncmFtbWUgOiBlYXUgc3RhZ25hbnRlLCBjZW5kcmUsIGJvaXMgc2VjLCBwaWVycmUsIGhlcmJlIHJhc2UuIEF1Y3VuIG4nZXN0IHVuIGxpZXUuIENlIHNvbnQgZGVzIGNvbmRpdGlvbnMu' },
  { n: 5, cycle: 0, type: 'pierre', t: 'UGllcnJlIGR1IHNldWls', b: 'Q2UgcXVpIGVudHJlIGVzdCBwZXPDqS4gQ2UgcXVpIHDDqHNlIGFzc2V6IGVzdCBnYXJkw6kuIENlIHF1aSBuZSBww6hzZSBwYXMgYXNzZXogZXN0IHJlbmR1LiBMZSB2ZXJiZSByZW5kdSBlc3QgZ3JhdsOpIGRldXggZm9pcywgbGEgc2Vjb25kZSBkJ3VuZSBtYWluIHRyZW1ibGFudGUu' },
  { n: 6, cycle: 0, type: 'parchemin', t: 'Q2FybmV0IGQndW4gZ8Opb23DqHRyZQ==', b: 'SidhaSBtZXN1csOpIGxhIGNoYXBlbGxlLiBTYSB0b3VyIG4nYSBqYW1haXMgcG9ydMOpIGRlIGNsb2NoZSA6IGwnb3V2ZXJ0dXJlIGR1IGhhdXQgbidlc3QgcGFzIGZhaXRlIHBvdXIgbGFpc3NlciBzb3J0aXIgbGUgc29uLCBlbGxlIGVzdCBmYWl0ZSBwb3VyIGxhaXNzZXIgZW50cmVyIGxlIGNpZWwuIEMnZXN0IHVuIG3DonQuIFVuIG3DonQgZGUgcXVvaSwgamUgbCdpZ25vcmUu' },
  { n: 7, cycle: 0, type: 'hieroglyphe', t: 'Q29sb25uZSBkZSByZWxldsOpcw==', b: 'UXVhdHJlIGNvbG9ubmVzIGRlIHNpZ25lcy4gTGEgdHJvaXNpw6htZSB2YXJpZSBkJ3VuIHRpZXJzIMOgIGNoYXF1ZSBsaWduZSwgbGVzIGF1dHJlcyBub24uIFVuIGNvcGlzdGUgYSBub3TDqSBlbiBtYXJnZSwgZW4gbGFuZ3VlIGh1bWFpbmUgOiBjZWxsZS1sw6AsIGMnZXN0IG5vdXMu' },
  { n: 8, cycle: 1, type: 'parchemin', t: 'Tm90ZSBkZSBsJ09yZHJlLCBhbiBpbmNvbm51', b: 'SWxzIG5lIHNvbnQgcGFzIHZlbnVzIHByZW5kcmUuIEMnZXN0IGNlIHF1aSBub3VzIGEgbGUgcGx1cyBsb25ndGVtcHMgdHJvbXDDqXMuIE9uIGd1ZXR0ZSB1bmUgYXJtw6llLCBvbiBuZSBndWV0dGUgcGFzIHVuIGphcmRpbmllci4=' },
  { n: 9, cycle: 1, type: 'sceau', t: 'U2NlYXUgZGUgc2Fpc29u', b: 'RGV1eCBhcmNzIGNvbmNlbnRyaXF1ZXMsIHVuIHBvaW50IGTDqWNlbnRyw6kuIEwnT3JkcmUgbCdhIGxvbmd0ZW1wcyBsdSBjb21tZSB1biDFk2lsLiBGcsOocmUgQWxkcmljIGEgcHJvcG9zw6kgdW5lIGF1dHJlIGxlY3R1cmUsIHF1aSBhIGZpbmkgcGFyIHMnaW1wb3NlciA6IGMnZXN0IHVuZSBzZXJyZSwgdnVlIGRlIGRlc3N1cy4=' },
  { n: 10, cycle: 1, type: 'pierre', t: 'UGllcnJlIGRlcyBtb3RzIGVtcHJ1bnTDqXM=', b: 'Tm91cyBhdm9ucyByZXRlbnUgc2VwdCBkZSBsZXVycyBtb3RzLiBBdWN1biBuZSBkaXQgY29ucXXDqXJpciwgdHVlciwgcsOpZ25lci4gSWxzIGRpc2VudCA6IHBhcmNlbGxlLCBzYWlzb24sIHJlbmRlbWVudCwgamFjaMOocmUsIGdyZWZmZSwgcsOpY29sdGUsIHJlYnV0Lg==' },
  { n: 11, cycle: 1, type: 'parchemin', t: 'RnJhZ21lbnQgZGUgcmFwcG9ydA==', b: 'SWxzIG5lIHBhcmxlbnQgcGFzLiBJbHMgbm90ZW50LiBKJ2FpIHZ1IHVuZSBzdXJmYWNlIHNlIGNvdXZyaXIgZGUgc2lnbmVzIHNhbnMgcXUnYXVjdW5lIG1haW4gbmUgYm91Z2UsIGV0IGonYWkgY29tcHJpcyBxdWUgamUgbidhc3Npc3RhaXMgcGFzIMOgIHVuZSBjb252ZXJzYXRpb24uIEonYXNzaXN0YWlzIMOgIHVuZSBwcmlzZSBkZSBtZXN1cmUsIGV0IGonZW4gw6l0YWlzIGwnb2JqZXQu' },
  { n: 12, cycle: 1, type: 'hieroglyphe', t: 'UGxhcXVlIGRlIGNhbGVuZHJpZXI=', b: 'VW5lIGFubsOpZSBkZSBsZXVyIGNhbGVuZHJpZXIgdmF1dCwgc2Vsb24gbGEgbWVpbGxldXJlIHJlY29uc3RydWN0aW9uLCBxdWF0cmUgY2VudCBvbnplIGRlcyBuw7R0cmVzLiBMZSBkb21haW5lIGVzdCBpbnNjcml0IHN1ciBjZXR0ZSBwbGFxdWUgw6AgbGEgc2Fpc29uIG5ldWYu' },
  { n: 13, cycle: 1, type: 'parchemin', t: 'TGV0dHJlIGRlIEZyw6hyZSBBbGRyaWM=', b: 'SidhaSBjZXNzw6kgZGUgbWUgZGVtYW5kZXIgcydpbHMgc29udCBib25zLiBPbiBuZSBkZW1hbmRlIHBhcyBjZWxhIGQndW5lIHNhaXNvbi4gTGEgcXVlc3Rpb24gdXRpbGUgZXN0IGF1dHJlIDogZGVwdWlzIGNvbWJpZW4gZGUgdGVtcHMgbGEgc2VycmUgdG91cm5lLXQtZWxsZSBzYW5zIGphcmRpbmllciA/' },
  { n: 14, cycle: 1, type: 'sceau', t: 'U2NlYXUgZGUgamFjaMOocmU=', b: 'VW4gcmVjdGFuZ2xlIGJhcnLDqS4gU3VyIGxlcyBzaXggc2NlYXV4IGNvbm51cywgY2VsdWktY2kgZXN0IGxlIHNldWwgcXVpIGFpdCDDqXTDqSByYXnDqSBhcHLDqHMgY291cCwgcHJvZm9uZMOpbWVudCwgcGFyIHVuIG91dGlsIHF1aSBuJ2VzdCBwYXMgZGVzIGxldXJzLg==' },
  { n: 15, cycle: 2, type: 'parchemin', t: 'UmVnaXN0cmUgZCdhZG1pc3Npb24sIHBhZ2UgYXJyYWNow6ll', b: 'RW50csOpZSAxMTA0IDogZmVtbWUsIHRyZW50ZSBldCB1biBhbnMsIGR1IHZpbGxhZ2UgYmFzLiBFbnRyw6llIDExMDUgOiBsYSBtw6ptZSwgZGV1eCBqb3VycyBwbHVzIHRhcmQuIExhIHNlY29uZGUgbGlnbmUgcG9ydGUgdW5lIG9ic2VydmF0aW9uIDogZGVudGl0aW9uIG1vZGlmacOpZSwgbmUgcGFybGUgcGx1cy4=' },
  { n: 16, cycle: 2, type: 'pierre', t: 'UGllcnJlIGR1IGJvdXJiaWVy', b: 'Tm91cyBsZXMgYXBwZWxpb25zIGTDqW1vbnMgcGFyY2UgcXVlIGxlIG1vdCBleGlzdGFpdC4gTGUgbW90IGp1c3RlIG4nZXhpc3RhaXQgcGFzIGVuY29yZSwgZXQgcXVhbmQgbm91cyBsJ2F2b25zIHRyb3V2w6ksIHBlcnNvbm5lIG4nYSB2b3VsdSBsJ8OpY3JpcmUuIEFsb3JzIGplIGwnw6ljcmlzIDogYnJvdWlsbG9ucy4=' },
  { n: 17, cycle: 2, type: 'parchemin', t: 'Tm90ZSBkJ3VuIGNoaXJ1cmdpZW4=', b: 'SidhaSBvdXZlcnQgbGEgY2hvc2UuIFNvdXMgbGEgY2hhaXIgaWwgeSBhIHVuIHNxdWVsZXR0ZSBodW1haW4sIGNvbXBsZXQsIGNvcnJlY3QsIHBsdXMgYW5jaWVuIHF1ZSBsYSBjaGFpciBxdWkgbGUgY291dnJlLiBRdWVscXUndW4gYSByZWLDonRpIHVuIGNvcnBzIGF1dG91ciBkJ3VuIG9zIHF1aSBhdmFpdCBkw6lqw6Agc2Vydmku' },
  { n: 18, cycle: 2, type: 'hieroglyphe', t: 'UGxhbmNoZSBkZSBjb21wYXJhaXNvbg==', b: 'VHJvaXMgc2lsaG91ZXR0ZXMgYWxpZ27DqWVzLiBMYSBwcmVtacOocmUgZXN0IHVuIGhvbW1lLiBMYSB0cm9pc2nDqG1lIGVzdCBjZSBxdWkgdHJhdmVyc2UgbGUgbWFyYWlzIGxhIG51aXQuIExhIGRldXhpw6htZSBuJ2EgamFtYWlzIMOpdMOpIG9ic2VydsOpZSB2aXZhbnRlIDogYydlc3QgdW5lIMOpdGFwZS4=' },
  { n: 19, cycle: 2, type: 'parchemin', t: 'Q2UgcXVlIGRpdCBsYSBzYW5nc3Vl', b: 'RWxsZSBzZSBub3Vycml0IGV0IGVsbGUgc2UgcsOpcGFyZS4gTm91cyB2b3lvbnMgdW4gbW9uc3RyZSBxdWkgdm9sZSBsYSB2aWUuIEplIHZvaXMgdW4gbcOpY2FuaXNtZSBxdWkgY29ycmlnZSB1bmUgZXJyZXVyIOKAlCBldCBxdWkgbidhIGphbWFpcyByZcOndSBsJ29yZHJlIGRlIHMnYXJyw6p0ZXIu' },
  { n: 20, cycle: 2, type: 'pierre', t: 'UGllcnJlIGR1IERhbW7DqQ==', b: 'SWwgc2UgZmVuZCBlbiBkZXV4IGV0IGxlcyBkZXV4IG1hcmNoZW50LiBDZSBuJ2VzdCBwYXMgZGUgbGEgbWFnaWUuIEMnZXN0IHVuZSBsaWduw6llIHF1J29uIGEgcG91c3PDqWUgw6Agc2UgcsOpcGxpcXVlciBldCBxdWkgbmUgc2FpdCBwbHVzIHMnYXJyw6p0ZXIgw6AgdW4gZXhlbXBsYWlyZS4=' },
  { n: 21, cycle: 2, type: 'sceau', t: 'U2NlYXUgZHUgcmVidXQ=', b: 'TGUgcGljdG9ncmFtbWUgZHUgcmVidXQsIGFncmFuZGkuIEVuIGRlc3NvdXMsIHVuIGNoaWZmcmUgOiBsYSBwcm9wb3J0aW9uIGRlIHJlYnV0IGp1Z8OpZSBhY2NlcHRhYmxlIHBvdXIgdW5lIHBhcmNlbGxlIGVuIGJvbm5lIHNhbnTDqS4gUXVhdHJlLXZpbmd0LXRyZWl6ZSBwb3VyIGNlbnQu' },
  { n: 22, cycle: 3, type: 'parchemin', t: 'UsOoZ2xlIGRlIGwnT3JkcmUsIGFydGljbGUgcHJlbWllcg==', b: 'Tm91cyBuZSBwYXJsb25zIHBhcy4gTm9uIHBhciBodW1pbGl0w6kgOiBsYSBwYXJvbGUgcHJvcGFnZSBsJ2FnZW50IHBsdXMgdml0ZSBxdWUgbGUgc2FuZywgZXQgbm9tbWVyIGxhIGNob3NlIGxhIGZhaXQgdmVuaXIuIENlbHVpIHF1aSBkb2l0IHRyYW5zbWV0dHJlLCBncmF2ZS4=' },
  { n: 23, cycle: 3, type: 'pierre', t: 'UGllcnJlIGRlIGZvbmRhdGlvbg==', b: 'Tm91cyDDqXRpb25zIGRvdXplLiBOb3VzIGF2aW9ucyB0cm91dsOpIHVuZSB0YWJsZXR0ZS4gTm91cyBhdm9ucyBtaXMgcXVhcmFudGUgYW5zIMOgIGNvbXByZW5kcmUgcXUnZWxsZSBuJ8OpdGFpdCBwYXMgbGEgcHJlbWnDqHJlLCBldCBzb2l4YW50ZSDDoCBhZG1ldHRyZSBxdSdlbGxlIG4nw6l0YWl0IHBhcyBsYSBkZXJuacOocmUu' },
  { n: 24, cycle: 3, type: 'parchemin', t: 'RMOpY2lzaW9uIGR1IGNvbmNsYXZl', b: 'TGUgdGV4dGUgY29tcGxldCBzZXJhIGTDqXRydWl0LiBJbCBzZXJhIGQnYWJvcmQgcmVjb3Bpw6kgZW4gcXVhcmFudGUtZGV1eCB0YWJsZXR0ZXMsIGRpc3BlcnPDqWVzIHNpIGxvaW4gbGVzIHVuZXMgZGVzIGF1dHJlcyBxdSdhdWN1biBob21tZSBwcmVzc8OpIG5lIGxlcyByw6l1bmlyYS4gTm91cyBuZSBjYWNob25zIHBhcyBsYSB2w6lyaXTDqS4gTm91cyBsYSByZW5kb25zIGxlbnRlLg==' },
  { n: 25, cycle: 3, type: 'sceau', t: 'U2NlYXUgZGUgbCdPcmRyZQ==', b: 'VW5lIGJvdWNoZSBmZXJtw6llIHBhciB1biB0cmFpdCBob3Jpem9udGFsLiBMZSB0cmFpdCBkw6lwYXNzZSBkZSBwYXJ0IGV0IGQnYXV0cmUsIGNvbW1lIHVuZSByw6hnbGUgZGUgbWVzdXJlIOKAlCBsZXMgZGV1eCBsZWN0dXJlcyBzb250IHZvbG9udGFpcmVzLg==' },
  { n: 26, cycle: 3, type: 'parchemin', t: 'TGV0dHJlIMOgIHVuIG9yZHJlIHJpdmFs', b: 'Vm9zIGZyw6hyZXMgcHJpZW50IHBvdXIgcXVlIGNlbGEgY2Vzc2UuIFByaWV6IHNpIGNlbGEgdm91cyBzb3VsYWdlLiBNYWlzIHNhY2hleiBxdWUgdm91cyBwcmlleiBkYW5zIGxhIGRpcmVjdGlvbiBkJ3VuIGluc3RydW1lbnQsIGV0IHF1ZSBsJ2luc3RydW1lbnQgbmUgdm91cyBlbnRlbmQgcGFzIHBsdXMgcXUndW5lIGJhbGFuY2UgbidlbnRlbmQgY2UgcXUnZWxsZSBww6hzZS4=' },
  { n: 27, cycle: 3, type: 'parchemin', t: 'RGVybmnDqHJlIGNvbnNpZ25l', b: 'UXVhbmQgbm91cyBuZSBzZXJvbnMgcGx1cyBxdWUgZGV1eCwgbGEgc3Vydml2YW50ZSBjZXNzZXJhIGQnw6ljcmlyZSBldCBzZSBjb250ZW50ZXJhIGQnYWxsZXIuIEVsbGUgbmUgZG9pdCByaWVuIHRyYW5zbWV0dHJlLiBFbGxlIGRvaXQgc2V1bGVtZW50IMOqdHJlIGzDoCBxdWFuZCBxdWVscXUndW4gdHJvdXZlcmEgbGEgcHJlbWnDqHJlIHRhYmxldHRlLg==' },
  { n: 28, cycle: 3, type: 'hieroglyphe', t: 'UGxhcXVlIGRlcyBxdWFyYW50ZS1kZXV4', b: 'UXVhcmFudGUtZGV1eCBjYXNlcy4gQ2hhY3VuZSBwb3J0ZSB1biBzaWduZSBkZXMgQXJwZW50ZXVycyBldCwgZW4gZGVzc291cywgc2EgcmVjb25zdHJ1Y3Rpb24gaHVtYWluZS4gT256ZSBjYXNlcyBzb250IHZpZGVzLiBFbiBtYXJnZSA6IG5vdXMgbidhdm9ucyBqYW1haXMgc3UgY2UgcXVlIG1lc3VyYWllbnQgbGVzIG9uemUgZGVybmnDqHJlcy4=' },
  { n: 29, cycle: 4, type: 'pierre', t: 'UGllcnJlIGR1IGNvbXB0ZQ==', b: 'TGEgbWVzdXJlIGR1cmUgdW5lIGRlbWktaGV1cmUuIENlIG4nZXN0IHBhcyB1bmUgZHVyw6llIGNob2lzaWUgcG91ciBub3VzLiBDJ2VzdCBsYSBkdXLDqWUgYXUgYm91dCBkZSBsYXF1ZWxsZSB1biDDqWNoYW50aWxsb24gY2Vzc2UgZGUgZm91cm5pciBkZXMgZG9ubsOpZXMgbm91dmVsbGVzLg==' },
  { n: 30, cycle: 4, type: 'parchemin', t: 'T2JzZXJ2YXRpb24gZCd1biB2ZWlsbGV1cg==', b: 'SidhaSB0ZW51IHZpbmd0LW5ldWYgbWludXRlcy4gw4AgbGEgdHJlbnRpw6htZSwgY2UgcXVpIGVzdCB2ZW51IG4nw6l0YWl0IHBhcyB1biBlbm5lbWkgZGUgcGx1cy4gQyfDqXRhaXQgbGEgZmluIGRlIGxhIHPDqWFuY2UuIE9uIG5lIGNvbWJhdCBwYXMgbGEgZmluIGQndW5lIHPDqWFuY2Uu' },
  { n: 31, cycle: 4, type: 'sceau', t: 'U2NlYXUgZGUgcsOpaW5pdGlhbGlzYXRpb24=', b: 'VW4gc2FibGllciByZW52ZXJzw6ksIHRyYXZlcnPDqSBkJ3VuZSBiYXJyZS4gTCdPcmRyZSBsJ2Egbm9tbcOpIGxhIEZhdWNoZXVzZSBmYXV0ZSBkZSBtaWV1eC4gQ2Ugbidlc3QgcGFzIHVuZSBmaWd1cmUgZGUgbGEgbW9ydC4gQydlc3QgdW4gYm91dG9uLg==' },
  { n: 32, cycle: 4, type: 'parchemin', t: 'Tm90ZSBlbiBtYXJnZSBkJ3VuIHJlZ2lzdHJl', b: 'TGUgbcOqbWUgaG9tbWUsIGFkbWlzIHF1YXRyZSBjZW50IGRvdXplIGZvaXMuIENoYXF1ZSBmb2lzIHBsdXMgbG9pbi4gQ2hhcXVlIGZvaXMgcmVuZHUuIElsIG5lIHNlIHNvdXZpZW50IGRlIHJpZW4sIGV0IHBvdXJ0YW50LCDDoCBsYSBxdWF0cmUgY2VudCBkb3V6acOobWUsIGlsIGEgaMOpc2l0w6kgYXUgYm9uIGVuZHJvaXQu' },
  { n: 33, cycle: 4, type: 'pierre', t: 'UGllcnJlIGRlcyBnZW1tZXM=', b: 'Q2UgcXVpIGJyaWxsZSBzdXIgbGVzIGNvcnBzIG91dmVydHMgbidlc3QgcGFzIHVuIHRyw6lzb3IuIEMnZXN0IGwnYWdlbnQgcXVpIHNlIGNyaXN0YWxsaXNlIGVuIHNvcnRhbnQuIExlcyByYW1hc3NlciwgYydlc3QgcydlbiBpbXByw6lnbmVyLiBNb250ZXIgbidlc3QgcGFzIGFwcHJlbmRyZS4gTW9udGVyLCBjJ2VzdCBhdmFuY2VyIHZlcnMgbGUgc2V1aWwu' },
  { n: 34, cycle: 4, type: 'hieroglyphe', t: 'Q291cmJlIGRlIHJlbmRlbWVudA==', b: 'VW5lIGNvdXJiZSBxdWkgbW9udGUsIG1hcnF1ZSB1biBwYWxpZXIsIHB1aXMgY2h1dGUuIExlIHBhbGllciBwb3J0ZSB1biBzaWduZSB0cmFkdWl0IHBhciBzZXVpbC4gTGEgY2h1dGUgcG9ydGUgdW4gc2lnbmUgdHJhZHVpdCBwYXIgY2UgcXVpIHZpZW50IGFwcsOocywgZXQgbCdPcmRyZSBuJ2EgamFtYWlzIHN1IHNpIGMnw6l0YWl0IHVuZSBwcm9tZXNzZSBvdSB1bmUgcGVydGUu' },
  { n: 35, cycle: 4, type: 'parchemin', t: 'TGV0dHJlIGluYWNoZXbDqWU=', b: 'U2kgdHUgbGlzIGNlY2ksIHR1IGFzIGNvbXByaXMgcXVlIHR1IG4nZXMgcGFzIGxlIHByZW1pZXIuIElsIG1lIHJlc3RlIMOgIHRlIGRpcmUgbGEgc2V1bGUgY2hvc2UgdXRpbGUsIGV0IGplIG5lIHNhaXMgcGFzIGNvbW1lbnQgbCfDqWNyaXJlIHNhbnMgcXVlIHR1IGNyb2llcyBxdWUgamUgZMOpbGlyZS4gTm91cyBuZSBzb21tZXMgcGFzIGVuZmVybcOpcyBkZWRhbnMuIE5vdXMgc29tbWVzIGNlIHF1aSBwb3Vzc2U=' },
  { n: 36, cycle: 5, type: 'parchemin', t: 'Q2UgcXVlIGRpdCBsZSBTYW5ndWluYWlyZQ==', b: 'SWwgbmUgcGFybGUgcGFzIG5vbiBwbHVzLiBNYWlzIGlsIGVzdCBsZSBzZXVsLCBkYW5zIHRvdXQgbGUgZG9tYWluZSwgw6AgcG9ydGVyIHVuIG51bcOpcm8gaW5mw6lyaWV1ciDDoCBtaWxsZS4gSWwgbidlc3QgcGFzIGxlIG1hw650cmUgZHUgbGlldS4gSWwgZXN0IGxlIHByZW1pZXIgw6ljaGFudGlsbG9uIGNvbnNlcnbDqS4=' },
  { n: 37, cycle: 5, type: 'pierre', t: 'UGllcnJlIGR1IHNldWlsIGZyYW5jaGk=', b: 'RnJhbmNoaXIgbGUgc2V1aWwgbmUgZMOpbGl2cmUgcGFzLiBDZWxhIGNoYW5nZSBjZSBxdWUgbCdvbiBlc3QgZW4gdHJhaW4gZGUgbWVzdXJlci4gUmllbiBkZSBwbHVzLiBSaWVuIGRlIG1vaW5zLiBDZXV4IHF1aSBsJ29udCBmcmFuY2hpIHNvbnQgdG91am91cnMgaWNpLCBldCBub3VzIGxlcyBhcHBlbG9ucyBib3NzLg==' },
  { n: 38, cycle: 5, type: 'sceau', t: 'U2NlYXUgZGUgY29uc2VydmF0aW9u', b: 'VW4gY29udG91ciBkZSBjb3JwcywgY2VybsOpIGQndW4gZG91YmxlIHRyYWl0LiBMYSBsw6lnZW5kZSByZWNvbnN0cnVpdGUgOiBzcMOpY2ltZW4gcmV0ZW51IHBvdXIgY29tcGFyYWlzb24uIExlIGRvbWFpbmUgbmUgZ2FyZGUgcGFzIHNlcyBtZWlsbGV1cnMgc3VqZXRzIHBhciBjcnVhdXTDqS4gSWwgbGVzIGdhcmRlIGNvbW1lIMOpdGFsb25zLg==' },
  { n: 39, cycle: 5, type: 'hieroglyphe', t: 'RGVybmllciByZWxldsOpIGNvbXBsZXQ=', b: 'UXVhcmFudGUtZGV1eCBjb2xvbm5lcyByZW1wbGllcy4gQydlc3QgbGUgc2V1bCBkb2N1bWVudCBpbnRhY3QgZHUgcmVjdWVpbC4gSWwgbmUgY29uY2x1dCByaWVuLiBJbCBuZSByZWNvbW1hbmRlIHJpZW4uIEMnZXN0IHVuZSBmaWNoZSwgZXQgZWxsZSBlc3QgY29ycmVjdGVtZW50IHJlbXBsaWUu' },
  { n: 40, cycle: 5, type: 'parchemin', t: 'Q29uZmVzc2lvbiBkZSBTxZN1ciBPbWJyZQ==', b: 'SmUgbidhaSBwYXMgZmFpdCB2xZN1IGRlIHNpbGVuY2UuIEonYWkgZXNzYXnDqSBkZSBwYXJsZXIsIHVuZSBmb2lzLCBpbCB5IGEgdHLDqHMgbG9uZ3RlbXBzLCBldCBqJ2FpIHZ1IGNlIHF1ZSBsYSBwYXJvbGUgYXBwZWxsZS4gRGVwdWlzLCBqZSBtYXJjaGUgZXQgamUgcmVnYXJkZS4gUXVlbHF1J3VuIGZpbmlyYSBwYXIgcmFtYXNzZXIgbGVzIHF1YXJhbnRlLWRldXgu' },
  { n: 41, cycle: 5, type: 'pierre', t: 'UGllcnJlIGRlIGwnYXViZQ==', b: 'T24gbm91cyBhIHByb21pcyBsJ2F1YmUgcG91ciB0ZW5pciBqdXNxdSdhdSBib3V0IGRlIGxhIG1lc3VyZS4gSWwgbid5IGEgcGFzIGQnYXViZS4gSWwgbid5IGEgcXVlIGxhIGZpbiBkZSBsYSBzw6lhbmNlIGV0IGxlIGTDqWJ1dCBkZSBsYSBzdWl2YW50ZS4gVGVuZXogcXVhbmQgbcOqbWUgOiBjJ2VzdCBsYSBzZXVsZSBjaG9zZSBxdSdpbHMgbmUgbWVzdXJlbnQgcGFzLg==' },
  { n: 42, cycle: 5, type: 'parchemin', t: 'TGEgdGjDqW9yaWUgcGVyZHVl', b: 'Tm91cyBsJ2F2b25zIGNoZXJjaMOpZSBwZW5kYW50IHNpeCBzacOoY2xlcywgZXQgbm91cyBsJ2F2b25zIHRyb3V2w6llIGVuIHLDqXVuaXNzYW50IG5vcyBwcm9wcmVzIHRhYmxldHRlcy4gSWwgbid5IGEgcGFzIGRlIHRow6lvcmllLiBJbCBuJ3kgYSBqYW1haXMgZXUgZGUgdGjDqW9yaWUuXG5cblF1YXJhbnRlLWRldXggcGFyYW3DqHRyZXMgcmVsZXbDqXMgcGFyIMOpY2hhbnRpbGxvbi4gVW5lIGNvbG9ubmUgcGFyIHBhcmFtw6h0cmUuIE5vcyBhbmPDqnRyZXMgb250IHJlY29wacOpIGF2ZWMgdW5lIGTDqXZvdGlvbiBhZG1pcmFibGUsIHN1ciBkZXMgdGFibGV0dGVzIGRlIHBpZXJyZSwgZW4geSBjb25zYWNyYW50IGxldXIgdmllIGVudGnDqHJlLCBsZSBmb3JtdWxhaXJlIGQnZW50csOpZS4=' },
];

/** Épilogue, hors numérotation, débloqué à 42/42. */
export const EPILOGUE = 'Vm91cyBhdmV6IGxlIGZvcm11bGFpcmUgY29tcGxldC5cblxuQ2VsYSBuZSByb3V2cmUgYXVjdW5lIHBvcnRlLCBuJ8OpdGVpbnQgYXVjdW5lIGx1bWnDqHJlLCBuZSBmYWl0IHBhcyB2ZW5pciBsJ2F1YmUuIExlIGRvbWFpbmUgdG91cm5lIGV4YWN0ZW1lbnQgY29tbWUgYXZhbnQsIHBhcmNlIHF1J2lsIG4nYSBqYW1haXMgZXUgYmVzb2luIHF1ZSB2b3VzIGNvbXByZW5pZXogcXVvaSBxdWUgY2Ugc29pdCBwb3VyIHRvdXJuZXIuXG5cblVuZSBzZXVsZSBjaG9zZSBhIGNoYW5nw6ksIGV0IGVsbGUgZXN0IHBldGl0ZSA6IGxhIHByb2NoYWluZSBmb2lzIHF1ZSB2b3VzIGVudHJlcmV6LCB2b3VzIHNhdXJleiBjZSBxdWUgdm91cyDDqnRlcyBlbiB0cmFpbiBkZSByZW1wbGlyLiBJbHMgbidvbnQgcGFzIHByw6l2dSBkZSBjb2xvbm5lIHBvdXIgY2VsYS5cblxuVGVuZXoganVzcXUnw6AgbCdhdWJlLiBFbGxlIG5lIHZpZW5kcmEgcGFzLlxuTm91cyBsZSBzYXZvbnMgdG91cyBsZXMgZGV1eCwgbWFpbnRlbmFudC4=';

export const TOTAL = FRAGMENTS.length;

/** Décode un champ. `atob` ne rend que des octets : il faut repasser par UTF-8. */
export function reveal(encoded: string): string {
  const bin = atob(encoded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Chiffres romains, pour la numérotation de l'Archive. */
export function roman(n: number): string {
  const table: [number, string][] = [
    [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}
