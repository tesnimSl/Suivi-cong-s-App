function leaveApp() {
  return {
    page:"dashboard", loading:true, error:"", toast:"", selectedYear:new Date().getFullYear(),
    years:[], operations:[], adjustments:[], audit:[], config:{}, calc:{months:[]},
    modal:null, editing:false, form:{}, adjustment:{}, search:"", filterType:"", filterStatus:"",
    newYear:new Date().getFullYear()+1,
    async init(){ await this.load(); },
    async api(body, year=this.selectedYear) {
      const url = body ? "/api/app" : "/api/app?year="+year;
      const r = await fetch(url,{method:body?"POST":"GET",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
      const d = await r.json(); if(!r.ok || d.error) throw new Error(d.error||"Erreur API"); return d;
    },
    async load(){
      this.loading=true;this.error="";
      try{
        const d=await this.api(); this.years=d.years||[];this.operations=d.operations||[];this.adjustments=d.adjustments||[];this.audit=d.audit||[];
        const current=this.years.find(y=>Number(y.year)===Number(this.selectedYear));
        const selected=current?d:await this.api(null,this.selectedYear);
        this.config=selected.config;this.calc=selected.calculation;
        if(!this.config) throw new Error("Paramètres de l’année introuvables.");
      }catch(e){this.error=e.message||"Impossible de charger les données.";}
      this.loading=false;
    },
    yearOptions(){return [...new Set([...this.years.map(y=>Number(y.year)),Number(this.selectedYear),new Date().getFullYear(),Number(this.newYear)])].filter(y=>y>=2000&&y<=2200).sort((a,b)=>b-a);},
    yearOperations(){return this.operations.filter(o=>Number(o.year)===Number(this.selectedYear));},
    filteredOperations(){const q=this.search.trim().toLowerCase();return this.yearOperations().filter(o=>(!this.filterType||o.leave_type===this.filterType)&&(!this.filterStatus||o.status===this.filterStatus)&&(!q||[o.comment,o.start_date,o.end_date,o.leave_type,o.status].join(" ").toLowerCase().includes(q))).sort((a,b)=>String(b.start_date).localeCompare(String(a.start_date)));},
    fmt(v){return (Number(v)||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});},
    monthLabel(n){return ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][n-1]||"";},
    pageTitle(){return ({dashboard:"Tableau de bord",monthly:"Suivi mensuel",operations:"Opérations de congés",history:"Historique & corrections",settings:"Paramètres"})[this.page]||"Suivi des congés";},
    typeLabel(t){return t==="paid"?"Congé payé":"Congé maladie";},
    statusLabel(s){return ({validated:"Validé",planned:"Planifié",cancelled:"Annulé"})[s]||s;},
    dateRange(o){return o.start_date===o.end_date?o.start_date:o.start_date+" → "+o.end_date;},
    formatTimestamp(s){try{return new Date(s).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});}catch{return s||"";}},
    auditSummary(d){try{const o=typeof d==="string"?JSON.parse(d):d;return [o.start_date,o.end_date,o.reason,o.days!=null?o.days+" jour(s)":""].filter(Boolean).join(" · ");}catch{return "";}},
    barHeight(v){const max=Math.max(1,...(this.calc.months||[]).map(m=>Number(m.closingPaid)||0));return Math.max(2,Math.min(100,Number(v)/max*100));},
    notify(s){this.toast=s;setTimeout(()=>this.toast="",3000);},
    openNew(){this.editing=false;const d=new Date();const date=String(this.selectedYear)+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");this.form={leave_type:"paid",status:"validated",start_date:date,end_date:date,days:1,comment:""};this.modal="operation";},
    editOperation(o){this.editing=true;this.form={...o,days:Number(o.days)};this.modal="operation";},
    autoDays(){if(!this.form.start_date||!this.form.end_date||this.form.end_date<this.form.start_date)return;const s=new Date(this.form.start_date+"T12:00:00"),e=new Date(this.form.end_date+"T12:00:00");let n=0;for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){if(this.config.day_mode==="calendaires"||(d.getDay()!==0&&d.getDay()!==6))n++;}this.form.days=n||.5;},
    async saveModal(){try{if(this.modal==="operation"){await this.api({action:this.editing?"update_operation":"create_operation",operation:{...this.form,days:Number(this.form.days)}});}else{await this.api({action:"create_adjustment",adjustment:{...this.adjustment,year:this.selectedYear,month:this.adjustment.month?Number(this.adjustment.month):null}});}this.modal=null;await this.load();this.notify("Modifications enregistrées.");}catch(e){this.notify(e.message);}},
    async deleteOperation(o){if(!confirm("Supprimer cette opération ?"))return;try{await this.api({action:"delete_operation",id:o.id});await this.load();this.notify("Opération supprimée.");}catch(e){this.notify(e.message);}},
    openAdjustment(){this.adjustment={leave_type:"paid",month:"",old_value:0,new_value:0,adjustment_date:new Date().toISOString().slice(0,10),reason:""};this.modal="adjustment";},
    async deleteAdjustment(a){if(!confirm("Supprimer cette correction ?"))return;try{await this.api({action:"delete_adjustment",id:a.id});await this.load();this.notify("Correction supprimée.");}catch(e){this.notify(e.message);}},
    async saveSettings(){try{await this.api({action:"save_year",config:{...this.config,year:Number(this.selectedYear)}});await this.load();this.notify("Paramètres enregistrés.");}catch(e){this.notify(e.message);}},
    async createYear(){const c={...this.config,year:Number(this.newYear),initial_paid:Number(this.calc.closingPaid),initial_sick:Number(this.config.sick_carry?this.calc.sickRemaining:this.config.annual_sick)};try{await this.api({action:"save_year",config:c});this.selectedYear=Number(this.newYear);await this.load();this.page="settings";this.notify("Nouvel exercice créé.");}catch(e){this.notify(e.message);}},
    exportCsv(){const rows=[["Mois","Solde initial CP","Crédit CP","CP pris","Solde final CP","Maladie prise","Solde maladie"]];for(const m of this.calc.months)rows.push([m.name,m.openingPaid,m.monthlyCredit,m.paidTaken,m.closingPaid,m.sickTaken,m.sickBalance]);const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="suivi-conges-"+this.selectedYear+".csv";a.click();URL.revokeObjectURL(a.href);},
    printReport(){window.print();}
  };
}
