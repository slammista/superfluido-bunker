import streamlit as st
import database as db
from datetime import datetime
import zoneinfo
import pandas as pd
import plotly.express as px
import uuid
from fpdf import FPDF
from streamlit_option_menu import option_menu
from streamlit_calendar import calendar as st_calendar

ROME_TZ = zoneinfo.ZoneInfo("Europe/Rome")

st.set_page_config(
    page_title="SUPERFLUIDO",
    page_icon="🎧",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
    <style>
        /* ── Font ───────────────────────────────────────────────────────── */
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap');

        html, body, p, h1, h2, h3, h4, h5, h6, label,
        div[data-testid="stMarkdownContainer"] > p, button {
            font-family: 'Montserrat', sans-serif !important;
        }

        /* ── Material Icons fix ─────────────────────────────────────────── */
        .material-symbols-rounded,
        [class*="material-symbols"],
        .stIconMaterial {
            font-family: 'Material Symbols Rounded' !important;
            font-weight: normal !important;
            font-style: normal !important;
            letter-spacing: normal !important;
            text-transform: none !important;
            white-space: nowrap !important;
            word-wrap: normal !important;
            direction: ltr !important;
        }

        /* ── Sfondo Totale ──────────────────────────────────────────────── */
        .stApp {
            background-image: url("static/GRAFICHE/background_main.png") !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            background-color: #000000 !important;
            min-height: 100vh !important;
        }

        /* ── Trasparenza assoluta su tutti i layer ──────────────────────── */
        [data-testid="stAppViewContainer"],
        [data-testid="stHeader"],
        [data-testid="stMainViewContainer"],
        [data-testid="stVerticalBlock"],
        [data-testid="stVerticalBlockBorderWrapper"],
        .main,
        .block-container,
        section[data-testid="stMainViewContainer"],
        .stForm,
        .stTabs {
            background-color: transparent !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        /* ── Nascondi chrome nativo Streamlit ───────────────────────────── */
        header[data-testid="stHeader"] > div:first-child { display: none !important; }
        header[data-testid="stHeader"]                   { display: none !important; }
        #MainMenu { visibility: hidden; }
        footer    { visibility: hidden; }

        /* ── Nascondi sidebar ───────────────────────────────────────────── */
        [data-testid="stSidebar"]        { display: none; }
        [data-testid="stSidebarNav"]     { display: none; }
        section[data-testid="stSidebar"] { width: 0px !important; }

        /* ── Navbar con glassmorphism ───────────────────────────────────── */
        div[data-testid="stHorizontalBlock"]:first-of-type {
            position: sticky;
            top: 0;
            z-index: 9999 !important;
            background: rgba(0, 0, 0, 0.6) !important;
            backdrop-filter: blur(15px) !important;
            -webkit-backdrop-filter: blur(15px) !important;
            border-bottom: 1px solid rgba(255, 107, 53, 0.1) !important;
            box-shadow: none !important;
            padding: 5px 0px;
        }

        /* ── Spacing fix ────────────────────────────────────────────────── */
        .main .block-container { padding-top: 80px !important; }

        /* ── Contorno sottile per container con bordo ───────────────────── */
        [data-testid="stVerticalBlockBorderWrapper"] {
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
        }

        /* ── Leggibilità testo (bianco sporco) ──────────────────────────── */
        .stApp p, .stApp h1, .stApp h2, .stApp h3,
        .stApp h4, .stApp h5, .stApp h6, .stApp label,
        .stApp div { color: #E0E0E0; }

        /* ── Input fields ───────────────────────────────────────────────── */
        div[data-testid="stTextInput"] input {
            background-color: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(255, 107, 53, 0.3) !important;
            color: #E0E0E0 !important;
        }

        /* ── Logout button ──────────────────────────────────────────────── */
        .logout-btn {
            background-color: #ff4b4b;
            color: white !important;
            border: none;
            border-radius: 8px;
            padding: 8px 18px;
            font-weight: 700;
            cursor: pointer;
            transition: filter 0.2s ease;
        }
        .logout-btn:hover { filter: brightness(1.2); }

        /* ── Rimozione hover lift ────────────────────────────────────────── */
        div[data-testid="stVerticalBlock"] > div:hover {
            transform: none !important;
            box-shadow: none !important;
        }

        /* ── Scrollbar macOS ────────────────────────────────────────────── */
        ::-webkit-scrollbar       { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #FF6B35; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #e55a25; }
    </style>
""", unsafe_allow_html=True)

# Inizializza session state
if "user" not in st.session_state:
    st.session_state.user = None
if "role" not in st.session_state:
    st.session_state.role = None
if "superfluido_hub" not in st.session_state:
    st.session_state.superfluido_hub = {}

# Dati mock per progetti rimosso - ora usano st.session_state

def get_user_role(user_id):
    """Recupera il ruolo dell'utente da Supabase"""
    try:
        response = db.supabase.table("user_roles").select("role").eq("id", user_id).single().execute()
        if response.data:
            return response.data["role"]
        return None
    except Exception as e:
        print(f"Errore nel recupero del ruolo: {e}")
        return None

def login_user(email, password):
    """Esegui il login con Supabase"""
    try:
        response = db.supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if response.user:
            st.session_state.user = response.user
            user_role = get_user_role(response.user.id)
            
            if user_role is None:
                st.error("❌ Ruolo non trovato. Contatta l'amministratore.")
                st.info(f"🔍 User ID: {response.user.id}")
                st.info("Assicurati che questo ID sia presente nella tabella 'user_roles'")
            else:
                st.session_state.role = user_role
                st.success("✅ Login effettuato con successo!")
                st.rerun()
        else:
            st.error("❌ Email o password non validi")
    except Exception as e:
        st.error(f"❌ Errore durante il login: {str(e)}")

def logout_user():
    """Esegui il logout"""
    try:
        db.supabase.auth.sign_out()
        st.session_state.user = None
        st.session_state.role = None
        st.success("✅ Logout effettuato")
        st.rerun()
    except Exception as e:
        st.error(f"Errore durante il logout: {e}")

def login_page():
    """Pagina di login centrata con colonne Streamlit."""

    # 3 colonne: le laterali fanno da cuscinetto vuoto
    col_left, col_center, col_right = st.columns([1, 1.2, 1])

    with col_center:
        # Centra il logo con un ulteriore set di colonne interne
        c1, c_logo, c2 = st.columns([1, 2, 1])
        with c_logo:
            st.image("GRAFICHE/logo_login.png", use_container_width=True)

        st.write("")

        with st.form("login_form", clear_on_submit=False):
            st.markdown(
                "<h2 style='text-align:center; color:#FF6B35; font-weight:800;"
                " margin-top:0;'>ACCEDI</h2>",
                unsafe_allow_html=True
            )
            email    = st.text_input("Email",    placeholder="utente@superfluido.it")
            password = st.text_input("Password", type="password", placeholder="••••••••")

            st.write("")

            if st.form_submit_button("🔓 ENTRA", use_container_width=True):
                if email and password:
                    login_user(email, password)
                else:
                    st.warning("⚠️ Inserisci le credenziali")

def home_page():
    """Dashboard principale - Spotify for Artists Style"""

    # ── 1. HEADER ────────────────────────────────────────────────────────────
    st.markdown("""
        <h1 style='font-weight: 800; font-size: 2.5rem; margin-bottom: 0;'>Overview</h1>
        <p style='color: #888; font-size: 1.1rem; margin-top: 0;'>Bentornato nel quartier generale, <strong>{}</strong></p>
    """.format(st.session_state.user.email), unsafe_allow_html=True)
    st.divider()

    # ── 2. STATS ROW (3 colonne — Membri Online rimosso) ─────────────────────
    try:
        prodotti_inventory = db.get_inventory()
        pezzi_totali = sum(
            v.get('stock_quantity', 0)
            for prod in prodotti_inventory
            for v in prod.get('product_variants', [])
        )
    except Exception:
        pezzi_totali = 0

    stats = [
        ("Progetti Attivi", len(st.session_state.superfluido_hub), "↑ +1", "verde"),
        ("Pezzi Magazzino", pezzi_totali, "↓ -5", "rosso"),
        ("Ultimo Upload", "Oggi", "✓", "blu"),
    ]
    colors = {"verde": "#00D966", "rosso": "#FF4444", "blu": "#00D9FF"}

    cols_stats = st.columns(3)
    for col, stat in zip(cols_stats, stats):
        with col:
            with st.container(border=True):
                st.caption(stat[0].upper())
                st.markdown(
                    f"<div style='font-size:2.2rem;font-weight:800;color:white;margin:10px 0;'>{stat[1]}</div>",
                    unsafe_allow_html=True
                )
                st.markdown(
                    f"<p style='color:{colors.get(stat[3], '#FF6B35')};font-size:0.9rem;margin:0;'>{stat[2]}</p>",
                    unsafe_allow_html=True
                )

    # ── 3. PROSSIMI APPUNTAMENTI ─────────────────────────────────────────────
    st.divider()
    st.subheader("🗓️ Prossimi Appuntamenti")
    try:
        eventi = db.get_all_events()
        oggi   = datetime.now(ROME_TZ).date()
        prossimi = [
            e for e in eventi
            if datetime.fromisoformat(
                e['data_evento'].replace('Z', '+00:00')
            ).astimezone(ROME_TZ).date() >= oggi
        ][:3]
    except Exception:
        prossimi = []

    if not prossimi:
        st.info("📭 Nessun evento in programma.")
    else:
        cols_ev = st.columns(3)
        for i, ev in enumerate(prossimi):
            with cols_ev[i]:
                with st.container(border=True):
                    dt = datetime.fromisoformat(
                        ev['data_evento'].replace('Z', '+00:00')
                    ).astimezone(ROME_TZ)
                    orario = dt.strftime('%H:%M')
                    if ev.get('data_fine'):
                        dt_f = datetime.fromisoformat(
                            ev['data_fine'].replace('Z', '+00:00')
                        ).astimezone(ROME_TZ)
                        orario += f" → {dt_f.strftime('%H:%M')}"
                    st.markdown(f"### {dt.strftime('%d %b')}")
                    st.markdown(f"**{ev['titolo']}**")
                    st.caption(f"🕐 {orario}  ·  📍 {ev.get('luogo') or 'Location non definita'}")
                    if st.button("Vedi →", key=f"go_cal_{ev['id']}", use_container_width=True):
                        st.info("Vai alla sezione Calendario nel menu!")

    # ── 4. RECENTI UPLOAD + ALERT MAGAZZINO ──────────────────────────────────
    st.divider()
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("🎵 Recenti Upload")
        if st.session_state.superfluido_hub:
            album_list = list(st.session_state.superfluido_hub.items())[-3:]
            for album_name, album_data in reversed(album_list):
                with st.container(border=True):
                    col_icon, col_info = st.columns([0.5, 4])
                    with col_icon:
                        st.markdown("<div style='font-size:1.8rem;margin-top:8px;'>🎵</div>", unsafe_allow_html=True)
                    with col_info:
                        st.markdown(f"**{album_name}**")
                        num_tracce = len(album_data.get('Tracce', []))
                        st.caption(f"{num_tracce} tracce • Ultimato oggi")
        else:
            st.info("📭 Nessun upload ancora")

    with col_right:
        st.subheader("⚠️ Alert Magazzino")
        try:
            prodotti_inventory = db.get_inventory()
            if not prodotti_inventory:
                st.info("📭 Nessun prodotto")
            else:
                scorte_basse = [
                    {'nome': prod.get('name', 'N/A'),
                     'qty': sum(v.get('stock_quantity', 0) for v in prod.get('varianti', []))}
                    for prod in prodotti_inventory
                    if sum(v.get('stock_quantity', 0) for v in prod.get('varianti', [])) < 15
                ]
                if scorte_basse:
                    with st.container(border=True):
                        st.markdown(
                            "<div style='border-left:4px solid #FF4444;padding:12px;border-radius:6px;'>"
                            "<p style='color:#FF4444;font-weight:600;margin-bottom:10px;'>🔴 Scorte Critiche</p>",
                            unsafe_allow_html=True
                        )
                        for item in scorte_basse:
                            st.markdown(
                                f"<p style='color:#FFA500;font-size:0.9rem;margin:5px 0;'>"
                                f"<strong>{item['nome']}</strong><br>"
                                f"<span style='color:#888;'>Solo {item['qty']} pz rimasti</span></p>",
                                unsafe_allow_html=True
                            )
                        st.markdown("</div>", unsafe_allow_html=True)
                else:
                    with st.container(border=True):
                        st.markdown(
                            "<div style='border-left:4px solid #00D966;padding:12px;border-radius:6px;'>"
                            "<p style='color:#00D966;font-weight:600;'>✅ Magazzino OK</p>"
                            "<p style='color:#888;font-size:0.9rem;'>Tutti i prodotti hanno scorte sufficienti</p>"
                            "</div>",
                            unsafe_allow_html=True
                        )
        except Exception:
            st.warning("⚠️ Errore nel caricamento magazzino")

    # ── 5. TEAM ONLINE ───────────────────────────────────────────────────────
    st.divider()
    with st.container(border=True):
        st.markdown("### 🟢 Team Online")
        st.caption("Artisti attualmente attivi nel gestionale")
        try:
            tutti_profili = db.get_all_profiles()
            foto_map = {
                p['nome_arte']: p.get('profile_picture_url')
                for p in tutti_profili if p.get('nome_arte')
            }
        except Exception:
            foto_map = {}

        membri = ["Slam", "None", "gg.proiettili", "Martire", "Eric Draven", "Leony47"]
        cols = st.columns(len(membri))
        for col, membro in zip(cols, membri):
            foto_url = foto_map.get(membro)
            iniziale = membro[0].upper()
            with col:
                if foto_url:
                    st.markdown(f"""
                        <div style='text-align:center;'>
                            <div style='position:relative;display:inline-block;'>
                                <img src="{foto_url}" style='width:52px;height:52px;border-radius:50%;
                                     object-fit:cover;border:2px solid #00D966;display:block;margin:0 auto;'>
                                <span style='position:absolute;bottom:2px;right:2px;width:12px;height:12px;
                                     border-radius:50%;background:#00D966;border:2px solid #111;
                                     display:inline-block;'></span>
                            </div>
                            <p style='color:#ccc;font-size:0.75rem;margin:6px 0 0 0;text-align:center;
                                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>{membro}</p>
                        </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                        <div style='text-align:center;'>
                            <div style='position:relative;display:inline-block;'>
                                <div style='width:52px;height:52px;border-radius:50%;
                                     background:linear-gradient(135deg,#FF6B35,#e55a25);
                                     display:flex;align-items:center;justify-content:center;
                                     font-weight:800;color:white;font-size:1.1rem;
                                     border:2px solid #00D966;margin:0 auto;'>{iniziale}</div>
                                <span style='position:absolute;bottom:2px;right:2px;width:12px;height:12px;
                                     border-radius:50%;background:#00D966;border:2px solid #111;
                                     display:inline-block;'></span>
                            </div>
                            <p style='color:#ccc;font-size:0.75rem;margin:6px 0 0 0;text-align:center;
                                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>{membro}</p>
                        </div>
                    """, unsafe_allow_html=True)

    # ── 6. GRAFICO ATTIVITÀ (full width, in fondo) ───────────────────────────
    st.divider()
    st.subheader("📈 Attività Recente (Ultimi 7 Giorni)")
    import numpy as np
    giorni      = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    interazioni = [12, 19, 15, 28, 31, 22, 18]
    df_trend = pd.DataFrame({'Giorni': giorni, 'Interazioni': interazioni})
    fig_trend = px.line(df_trend, x='Giorni', y='Interazioni', line_shape='spline', markers=True)
    fig_trend.update_traces(line=dict(color='#FF6B35', width=3), marker=dict(size=8, color='#FF6B35'))
    fig_trend.update_layout(
        height=300,
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(family="Montserrat", color="white", size=11),
        xaxis=dict(showgrid=False, zeroline=False, showline=False),
        yaxis=dict(showgrid=False, zeroline=False, showline=False)
    )
    st.plotly_chart(fig_trend, use_container_width=True)

def magazzino_page():
    """Gestione magazzino e merchandising - Professional Edition"""
    st.title("📦 Magazzino Merchandising")
    st.divider()
    
    # Inizializza session state per varianti temporanee
    if 'temp_vars' not in st.session_state:
        st.session_state.temp_vars = [{"nome": "", "qty": 0}]
    
    tab1, tab2 = st.tabs(["📦 Inventario", "➕ Aggiungi Nuovo Prodotto"])
    
    # ==================== TAB 1: INVENTARIO (LETTURA + VENDITA) ====================
    with tab1:
        st.subheader("📋 Inventario Disponibile")
        
        # Carica dati dal database
        prodotti_raw = db.get_inventory()
        
        if not prodotti_raw:
            st.info("📭 Nessun prodotto in magazzino. Aggiungine uno dalla tab '➕ Aggiungi Nuovo Prodotto'")
        else:
            # Costruisci DataFrame con calcoli
            dati_magazzino = []
            
            for prodotto in prodotti_raw:
                # Calcola Quantità Totale sommando le varianti
                qty_totale = sum(v.get('stock_quantity', 0) for v in prodotto.get('product_variants', []))
                
                # Calcola Margine
                base_sell = prodotto.get('base_price_sell', 0) or 0
                base_cost = prodotto.get('base_price_cost', 0) or 0
                margine = base_sell - base_cost
                
                dati_magazzino.append({
                    'ID': prodotto.get('id', ''),
                    'Nome': prodotto.get('name', 'N/A'),
                    'Categoria': prodotto.get('category', 'N/A'),
                    'Quantità Totale': qty_totale,
                    'Prezzo Vendita': base_sell,
                    'Costo Produzione': base_cost,
                    'Margine': margine,
                    'Varianti': prodotto.get('product_variants', [])
                })
            
            df = pd.DataFrame(dati_magazzino)
            
            if df.empty:
                st.info("📭 Nessun prodotto disponibile")
            else:
                # Filtri
                col_filter1, col_filter2 = st.columns(2)
                
                with col_filter1:
                    categorie = ["Tutte"] + sorted(df['Categoria'].unique().tolist())
                    categoria_filter = st.selectbox("Filtra per Categoria", categorie)
                
                with col_filter2:
                    ricerca = st.text_input("🔍 Cerca prodotto...")
                
                # Applica filtri
                dati_filtrati = df.copy()
                
                if categoria_filter != "Tutte":
                    dati_filtrati = dati_filtrati[dati_filtrati['Categoria'] == categoria_filter]
                
                if ricerca:
                    dati_filtrati = dati_filtrati[dati_filtrati['Nome'].str.contains(ricerca, case=False, na=False)]
                
                st.divider()
                
                # Mostra prodotti
                if dati_filtrati.empty:
                    st.info("❌ Nessun prodotto corrisponde ai filtri")
                else:
                    for idx, row in dati_filtrati.iterrows():
                        with st.container(border=True):
                            col_main, col_action = st.columns([4, 1])
                            
                            with col_main:
                                # Header con nome e categoria
                                st.markdown(f"### **{row['Nome']}** • 📂 {row['Categoria']}")
                                
                                # Pillole con varianti (Bandcamp Style)
                                varianti_html = ""
                                if row['Varianti']:
                                    pillole = []
                                    for v in row['Varianti']:
                                        nome_var = v.get('variant_name', 'N/A')
                                        qty_var = v.get('stock_quantity', 0)
                                        pillole.append(f"<span style='background-color: #3a3a3a; padding: 4px 12px; border-radius: 16px; margin-right: 8px; font-size: 0.85rem; color: #ccc;'>{nome_var}: {qty_var}pz</span>")
                                    varianti_html = " ".join(pillole)
                                
                                if varianti_html:
                                    st.markdown(f"<div style='margin: 8px 0;'>{varianti_html}</div>", unsafe_allow_html=True)
                                
                                # Stats row
                                stat_col1, stat_col2, stat_col3 = st.columns(3)
                                with stat_col1:
                                    st.metric("📊 Quantità Totale", f"{row['Quantità Totale']} pz", delta=None)
                                with stat_col2:
                                    st.metric("💵 Prezzo Vendita", f"€{row['Prezzo Vendita']:.2f}", delta=None)
                                with stat_col3:
                                    margine_color = "#00D966" if row['Margine'] > 0 else "#FF4444"
                                    st.markdown(f"<div style='background-color: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; text-align: center;'><p style='margin: 0; color: {margine_color}; font-weight: 800; font-size: 1.2rem;'>€{row['Margine']:.2f}</p><p style='margin: 4px 0 0 0; color: #888; font-size: 0.8rem;'>Margine</p></div>", unsafe_allow_html=True)
                            
                            with col_action:
                                # Popover Registra Vendita
                                with st.popover("💰 Registra Vendita", use_container_width=True):
                                    st.write(f"**{row['Nome']}**")
                                    
                                    if row['Varianti']:
                                        # Crea liste per selectbox con ID interno
                                        varianti_opciones = []
                                        varianti_ids = {}
                                        
                                        for v in row['Varianti']:
                                            nome_var = v.get('variant_name', 'N/A')
                                            var_id = v.get('id', '')
                                            qty_var = v.get('stock_quantity', 0)
                                            
                                            display_text = f"{nome_var} ({qty_var}pz)"
                                            varianti_opciones.append(display_text)
                                            varianti_ids[display_text] = var_id
                                        
                                        variante_scelta = st.selectbox(
                                            "Scegli Variante",
                                            varianti_opciones,
                                            key=f"var_vendita_{row['ID']}"
                                        )
                                        variant_id = varianti_ids[variante_scelta]
                                    else:
                                        variant_id = None
                                        st.write("Variante: **Unico**")
                                    
                                    qty_vendita = st.number_input("Quantità da vendere", min_value=1, value=1, key=f"qty_vendita_{row['ID']}")
                                    
                                    if st.button("✅ Conferma Vendita", key=f"confirm_vendita_{row['ID']}", use_container_width=True):
                                        try:
                                            if variant_id:
                                                # Aggiorna lo stock nel DB
                                                if db.update_variant_stock(variant_id, qty_vendita):
                                                    st.success("✅ Vendita registrata!")
                                                    st.rerun()
                                                else:
                                                    st.error("❌ Errore nell'aggiornamento stock")
                                            else:
                                                st.warning("⚠️ Seleziona una variante")
                                        except Exception as e:
                                            st.error(f"❌ Errore: {str(e)}")
                                
                                st.divider()
                                
                                # Bottone Elimina Prodotto
                                if st.button("🗑️ Elimina", key=f"del_prod_{row['ID']}", use_container_width=True, type="secondary"):
                                    with st.spinner("Eliminazione..."):
                                        if db.delete_product(row['ID']):
                                            st.success("✅ Prodotto eliminato!")
                                            st.rerun()
                                        else:
                                            st.error("❌ Errore nell'eliminazione")
    
    # ==================== TAB 2: AGGIUNGI PRODOTTO (SCRITTURA) ====================
    with tab2:
        st.subheader("➕ Nuovo Prodotto")
        
        col_nome, col_categoria = st.columns(2)
        
        with col_nome:
            nome_prodotto = st.text_input("Nome Prodotto", placeholder="Es: T-Shirt SUPERFLUIDO", key="new_prod_name")
        
        with col_categoria:
            categoria = st.selectbox("Categoria", ["CD", "Vinili", "Vestiario", "Tele", "Altro"], key="new_prod_cat")
        
        col_prezzo_sell, col_prezzo_cost = st.columns(2)
        
        with col_prezzo_sell:
            prezzo_vendita = st.number_input("Prezzo di Vendita €", min_value=0.0, step=0.50, key="new_prod_sell")
        
        with col_prezzo_cost:
            prezzo_costo = st.number_input("Costo di Produzione €", min_value=0.0, step=0.50, key="new_prod_cost")
        
        st.write("")
        
        st.markdown("**Varianti e Quantità**")
        st.caption("Aggiungi varianti con nome e quantità (es. Taglia S con 10 pezzi)")
        
        # Gestisci le righe varianti FUORI dal form
        for idx, var in enumerate(st.session_state.temp_vars):
            col_var_nome, col_var_qty, col_var_del = st.columns([2, 1, 0.5])
            
            with col_var_nome:
                st.session_state.temp_vars[idx]['nome'] = st.text_input(
                    "Nome variante",
                    value=var['nome'],
                    placeholder="Es: Taglia S",
                    key=f"var_nome_{idx}"
                )
            
            with col_var_qty:
                st.session_state.temp_vars[idx]['qty'] = st.number_input(
                    "Quantità",
                    value=var['qty'],
                    min_value=0,
                    key=f"var_qty_{idx}"
                )
            
            with col_var_del:
                if st.button("❌", key=f"del_var_{idx}", use_container_width=True):
                    st.session_state.temp_vars.pop(idx)
                    st.rerun()
        
        # Bottone per aggiungere riga variante FUORI dal form
        if st.button("➕ Aggiungi Riga Variante", use_container_width=True):
            st.session_state.temp_vars.append({"nome": "", "qty": 0})
            st.rerun()
        
        st.write("")
        
        # FORM per il submit
        with st.form("add_product_form"):
            st.info("Compila i campi sopra e premi per confermare")
            
            if st.form_submit_button("🚀 Aggiungi Prodotto", type="primary", use_container_width=True):
                if not nome_prodotto:
                    st.error("❌ Inserisci il nome del prodotto")
                elif not any(v['nome'].strip() for v in st.session_state.temp_vars):
                    st.error("❌ Aggiungi almeno una variante")
                else:
                    try:
                        with st.spinner("Caricamento..."):
                            # Crea prodotto nel DB
                            nuovo_prodotto = db.create_product(
                                nome_prodotto,
                                categoria,
                                prezzo_vendita,
                                prezzo_costo
                            )
                            
                            if not nuovo_prodotto:
                                st.error("❌ Errore nella creazione del prodotto")
                            else:
                                prodotto_id = nuovo_prodotto['id']
                                varianti_create = 0
                                
                                # Crea varianti
                                for var in st.session_state.temp_vars:
                                    if var['nome'].strip():
                                        result = db.create_product_variant(
                                            prodotto_id,
                                            var['nome'].strip(),
                                            var['qty']
                                        )
                                        if result:
                                            varianti_create += 1
                                
                                st.success(f"✅ Prodotto '{nome_prodotto}' aggiunto con {varianti_create} varianti!")
                                
                                # Resetta il session state
                                st.session_state.temp_vars = [{"nome": "", "qty": 0}]
                                
                                st.rerun()
                    
                    except Exception as e:
                        st.error(f"❌ Errore: {str(e)}")

def progetti_page():
    """Studio Hub - Con Supabase DB e Storage"""
    st.title("🎧 Studio Hub - Progetti Privati")
    st.write("Spazio esclusivo per i 6 artisti di SUPERFLUIDO")
    st.divider()
    
    user_id = st.session_state.user.id
    
    # Inizializza session state per la vista
    if "album_aperto" not in st.session_state:
        st.session_state.album_aperto = None
    if "selected_audio" not in st.session_state:
        st.session_state.selected_audio = None
    if "albums_cache" not in st.session_state:
        st.session_state.albums_cache = []
    if "tracce_cache" not in st.session_state:
        st.session_state.tracce_cache = []
    
    # Carica dati dal DB all'inizio
    with st.spinner("Caricamento progetti..."):
        st.session_state.albums_cache = db.get_all_albums(user_id)
        st.session_state.tracce_cache = db.get_all_tracce(user_id)
    
    tab1, tab2 = st.tabs(["📂 Consulta Studio Hub", "➕ Crea Nuovo Progetto"])
    
    with tab1:
        # VISTA 1: Griglia Album (se album_aperto è None)
        if st.session_state.album_aperto is None:
            st.subheader("📂 I Tuoi Progetti")
            
            if not st.session_state.albums_cache:
                st.info("📭 Nessun album creato. Creane uno nuovo dalla tab '➕ Crea Nuovo Progetto'!")
            else:
                cols = st.columns(3)
                
                for idx, album in enumerate(st.session_state.albums_cache):
                    col_idx = idx % 3
                    album_id = album['id']
                    nome_album = album['nome_album']
                    cover_url = album.get('cover_image_url')
                    
                    # Conta tracce per questo album
                    tracce_album = [t for t in st.session_state.tracce_cache if t['album_id'] == album_id]
                    tracce_count = len(tracce_album)
                    
                    with cols[col_idx]:
                        # Mostra copertina se esiste
                        if cover_url:
                            st.image(cover_url, use_container_width=True)
                        else:
                            # Placeholder scuro
                            first_letters = nome_album[:2].upper()
                            st.markdown(f"""
                                <div style='
                                    width: 100%;
                                    aspect-ratio: 1;
                                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                                    border-radius: 12px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    margin-bottom: 12px;
                                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                                '>
                                    <div style='
                                        font-size: 3rem;
                                        font-weight: 800;
                                        color: #FF6B35;
                                        letter-spacing: -2px;
                                    '>
                                        {first_letters}
                                    </div>
                                </div>
                            """, unsafe_allow_html=True)
                        
                        st.markdown(f"""
                            <div style='margin: 0;'>
                                <p style='
                                    font-weight: 600;
                                    font-size: 1rem;
                                    color: white;
                                    margin: 8px 0 4px 0;
                                '>
                                    {nome_album}
                                </p>
                                <p style='
                                    color: #666;
                                    font-size: 0.85rem;
                                    margin: 0;
                                '>
                                    {tracce_count} tracce
                                </p>
                            </div>
                        """, unsafe_allow_html=True)
                        
                        if st.button("Apri", key=f"apri_{album_id}", use_container_width=True):
                            st.session_state.album_aperto = album_id
                            st.rerun()
        
        # VISTA 2: Split View - Dettaglio Album
        else:
            album_id = st.session_state.album_aperto
            
            # Trova album nei dati
            album_data = next((a for a in st.session_state.albums_cache if a['id'] == album_id), None)
            
            if not album_data:
                st.error("Album non trovato")
                if st.button("Torna"):
                    st.session_state.album_aperto = None
                    st.rerun()
            else:
                nome_album = album_data['nome_album']
                cover_url = album_data.get('cover_image_url')
                
                # Layout Split
                col_left, col_right = st.columns([1, 2.5])
                
                # ========== COLONNA SX ==========
                with col_left:
                    if st.button("⬅️", key="back_albums", use_container_width=True):
                        st.session_state.album_aperto = None
                        st.session_state.selected_audio = None
                        st.rerun()
                    
                    st.write("")
                    
                    if cover_url:
                        st.image(cover_url, use_container_width=True)
                    else:
                        first_letters = nome_album[:2].upper()
                        st.markdown(f"""
                            <div style='
                                width: 100%;
                                aspect-ratio: 1;
                                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                                border-radius: 12px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-bottom: 12px;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                            '>
                                <div style='
                                    font-size: 4rem;
                                    font-weight: 800;
                                    color: #FF6B35;
                                    letter-spacing: -2px;
                                '>
                                    {first_letters}
                                </div>
                            </div>
                        """, unsafe_allow_html=True)
                    
                    # Modifica copertina
                    with st.popover("🖼️ Cambia copertina", use_container_width=True):
                        st.write("**Carica nuova copertina**")
                        new_cover = st.file_uploader(
                            "Seleziona immagine",
                            type=["jpg", "png", "jpeg"],
                            key=f"update_cover_{album_id}"
                        )
                        
                        if new_cover is not None:
                            if st.button("Salva", key=f"save_cover_{album_id}", use_container_width=True):
                                try:
                                    # Se c'era una copertina vecchia, eliminala
                                    if cover_url:
                                        try:
                                            old_path = cover_url.split('/public/superfluido_bucket/')[-1]
                                            db.delete_file_from_storage('superfluido_bucket', old_path)
                                        except:
                                            pass
                                    
                                    # Carica nuova copertina
                                    with st.spinner("Caricamento..."):
                                        sanitized_cover = db.sanitize_filename(new_cover.name)
                                        new_cover_path = f"covers/{uuid.uuid4()}_{sanitized_cover}"
                                        if db.upload_file_to_storage('superfluido_bucket', new_cover_path, new_cover.getvalue()):
                                            new_cover_url = db.get_public_url('superfluido_bucket', new_cover_path)
                                            
                                            # Aggiorna nel DB
                                            if db.update_album_cover(album_id, new_cover_url):
                                                st.success("✅ Copertina aggiornata")
                                                st.session_state.albums_cache = db.get_all_albums(user_id)
                                                st.rerun()
                                            else:
                                                st.error("❌ Errore nell'aggiornamento DB")
                                        else:
                                            st.error("❌ Errore nell'upload")
                                except Exception as e:
                                    st.error(f"❌ Errore: {str(e)}")
                    
                    st.write("")
                    
                    st.markdown(f"""
                        <h1 style='
                            font-size: 2rem;
                            font-weight: 800;
                            letter-spacing: -1px;
                            margin: 0;
                            margin-bottom: 12px;
                            line-height: 1;
                            word-wrap: break-word;
                        '>
                            {nome_album}
                        </h1>
                    """, unsafe_allow_html=True)
                    
                    with st.popover("✏️ Rinomina", use_container_width=False):
                        st.write("**Rinomina Album**")
                        nuovo_nome_album = st.text_input(
                            "Nuovo nome",
                            value=nome_album,
                            key="new_album_name_split"
                        )
                        
                        if st.button("Salva", key="save_album_name_split", use_container_width=True):
                            if nuovo_nome_album and nuovo_nome_album != nome_album:
                                result = db.update_album_name(album_id, nuovo_nome_album)
                                if result:
                                    st.success(f"✅ Album rinominato")
                                    st.session_state.album_aperto = None
                                    st.rerun()
                                else:
                                    st.error("❌ Errore nell'aggiornamento")
                
                # ========== COLONNA DX ==========
                with col_right:
                    fase_filtro = st.radio(
                        "Filtra per Fase",
                        ["Tutte", "Beat", "Provini", "Mix", "Master"],
                        horizontal=True,
                        key="fase_filtro_split"
                    )
                    
                    st.write("")
                    
                    # Tracce per questo album
                    tracce_album = [t for t in st.session_state.tracce_cache if t['album_id'] == album_id]
                    
                    if fase_filtro == "Tutte":
                        tracce_filtrate = tracce_album
                    else:
                        tracce_filtrate = [t for t in tracce_album if t.get('fase') == fase_filtro]
                    
                    if not tracce_filtrate:
                        st.info(f"📭 Nessuna traccia{f" in fase '{fase_filtro}'" if fase_filtro != "Tutte" else ""}")
                    else:
                        for idx, traccia in enumerate(tracce_filtrate):
                            traccia_id = traccia['id']
                            col_play, col_nome, col_badge, col_opt = st.columns([0.7, 4, 1.2, 0.5])
                            
                            with col_play:
                                if st.button("▶️", key=f"play_split_{traccia_id}_{idx}", use_container_width=True):
                                    st.session_state.selected_audio = traccia
                                    st.rerun()
                            
                            with col_nome:
                                st.markdown(f"""
                                    <p style='
                                        color: white;
                                        font-weight: 500;
                                        margin: 0;
                                        font-size: 1rem;
                                    '>
                                        {traccia['nome_traccia']}
                                    </p>
                                """, unsafe_allow_html=True)
                            
                            with col_badge:
                                st.markdown(f"""
                                    <div style='
                                        background-color: #2a2a2a;
                                        border-radius: 20px;
                                        padding: 4px 12px;
                                        display: inline-block;
                                    '>
                                        <p style='
                                            color: #999;
                                            font-size: 0.75rem;
                                            margin: 0;
                                            font-weight: 500;
                                        '>
                                            {traccia['fase']}
                                        </p>
                                    </div>
                                """, unsafe_allow_html=True)
                            
                            with col_opt:
                                with st.popover("⚙️", key=f"options_split_{traccia_id}_{idx}"):
                                    st.write("**Gestisci**")
                                    
                                    nuovo_nome_traccia = st.text_input(
                                        "Nuovo nome",
                                        value=traccia['nome_traccia'],
                                        key=f"rename_traccia_split_{idx}"
                                    )
                                    
                                    if st.button("Aggiorna", key=f"update_traccia_split_{idx}", use_container_width=True):
                                        if nuovo_nome_traccia and nuovo_nome_traccia != traccia['nome_traccia']:
                                            result = db.update_traccia_name(traccia_id, nuovo_nome_traccia)
                                            if result:
                                                st.success(f"✅ Rinominata")
                                                st.rerun()
                                            else:
                                                st.error("❌ Errore")
                                    
                                    st.divider()
                                    
                                    if st.button("Elimina", key=f"del_split_{traccia_id}_{idx}", type="primary", use_container_width=True):
                                        try:
                                            # Elimina da Storage
                                            audio_url = traccia.get('audio_file_url')
                                            if audio_url:
                                                # Estrai il path dal URL pubblico
                                                file_path = audio_url.split('/public/superfluido_bucket/')[-1]
                                                db.delete_file_from_storage('superfluido_bucket', file_path)
                                            
                                            # Elimina dal DB
                                            if db.delete_traccia(traccia_id):
                                                st.success("✅ Eliminata")
                                                st.session_state.tracce_cache = db.get_all_tracce(user_id)
                                                st.rerun()
                                            else:
                                                st.error("❌ Errore nell'eliminazione")
                                        except Exception as e:
                                            st.error(f"❌ Errore: {str(e)}")
                            
                            st.write("")
                
                # ========== PLAYER AUDIO ==========
                st.divider()
                
                if st.session_state.selected_audio:
                    traccia_selezionata = st.session_state.selected_audio
                    st.markdown(f"""
                        <p style='
                            color: #999;
                            font-size: 0.9rem;
                            margin-bottom: 12px;
                        '>
                            Ora in riproduzione: <strong style='color: white;'>{traccia_selezionata['nome_traccia']}</strong> • {traccia_selezionata['fase']}
                        </p>
                    """, unsafe_allow_html=True)
                    
                    audio_url = traccia_selezionata.get('audio_file_url')
                    if audio_url:
                        st.audio(audio_url)
                    else:
                        st.warning("⚠️ Nessun audio disponibile")
    
    with tab2:
        st.write("")
        
        with st.form("create_project_form"):
            col_album_name, col_traccia_name = st.columns(2)
            
            with col_album_name:
                nome_album = st.text_input(
                    "Nome Album/Progetto",
                    placeholder="Es: ALBUM_2024",
                    key="form_album_name"
                )
            
            with col_traccia_name:
                nome_traccia = st.text_input(
                    "Nome Traccia",
                    placeholder="Es: NOTTE_URBANA",
                    key="form_traccia_name"
                )
            
            st.write("")
            
            col_fase, col_spacer = st.columns([1, 1])
            
            with col_fase:
                fase_traccia = st.selectbox(
                    "Fase Traccia",
                    ["Beat", "Provini", "Mix", "Master"],
                    key="form_fase_traccia"
                )
            
            st.write("")
            
            st.subheader("📤 Carica Audio")
            audio_file = st.file_uploader(
                "File audio (.wav, .mp3)",
                help="WAV o MP3",
                key="form_audio_upload"
            )
            
            if audio_file is not None:
                st.markdown(f"""
                    <p style='color: #00D966; font-size: 0.9rem;'>
                        ✅ {audio_file.name}
                    </p>
                """, unsafe_allow_html=True)
            
            st.write("")
            
            st.subheader("🖼️ Copertina Album (Opzionale)")
            cover_file = st.file_uploader(
                "Immagine copertina (.jpg, .png)",
                help="JPG o PNG",
                key="form_cover_upload"
            )
            
            if cover_file is not None:
                st.markdown(f"""
                    <p style='color: #00D9FF; font-size: 0.9rem;'>
                        ✅ {cover_file.name}
                    </p>
                """, unsafe_allow_html=True)
            
            st.write("")
            
            if st.form_submit_button("🚀 Crea", type="primary", use_container_width=True):
                if nome_album and nome_traccia and audio_file:
                    try:
                        # 1. Controlla se album esiste già
                        album_esistente = db.get_album_by_name(user_id, nome_album)
                        
                        if not album_esistente:
                            # 2. Upload copertina (opzionale)
                            cover_url = None
                            if cover_file:
                                with st.spinner("Upload copertina..."):
                                    cover_path = f"covers/{uuid.uuid4()}_{cover_file.name}"
                                    if db.upload_file_to_storage('superfluido_bucket', cover_path, cover_file.getvalue()):
                                        cover_url = db.get_public_url('superfluido_bucket', cover_path)
                            
                            # 3. Crea album nel DB
                            album_result = db.create_album(user_id, nome_album, cover_url)
                            
                            if not album_result:
                                st.error("❌ Errore nella creazione dell'album")
                            else:
                                album_id = album_result['id']
                        else:
                            album_id = album_esistente['id']
                        
                        # 4. Upload audio
                        with st.spinner("Upload audio..."):
                            sanitized_audio = db.sanitize_filename(audio_file.name)
                            audio_path = f"audio/{uuid.uuid4()}_{sanitized_audio}"
                            if not db.upload_file_to_storage('superfluido_bucket', audio_path, audio_file.getvalue()):
                                st.error("❌ Errore nell'upload dell'audio")
                            else:
                                audio_url = db.get_public_url('superfluido_bucket', audio_path)
                                
                                # 5. Crea traccia nel DB
                                traccia_result = db.create_traccia(album_id, user_id, nome_traccia, fase_traccia, audio_url)
                                
                                if traccia_result:
                                    st.success(f"✅ Traccia aggiunta all'album '{nome_album}'!")
                                    st.balloons()
                                    
                                    # Ricarica cache
                                    st.session_state.albums_cache = db.get_all_albums(user_id)
                                    st.session_state.tracce_cache = db.get_all_tracce(user_id)
                                    
                                    st.rerun()
                                else:
                                    st.error("❌ Errore nella creazione della traccia")
                    
                    except Exception as e:
                        st.error(f"❌ Errore: {str(e)}")
                else:
                    st.warning("⚠️ Compila: Album, Traccia e Audio")
    


def _genera_pdf_presskit(bio_superfluido, tipo_evento, dati_selezionati, strumentazione_combinata, bottiglie_acqua, num_persone, email_superfluido):
    """Genera un PDF professionale stile Press Kit & Tech Rider (fpdf2)."""

    # Colori professionali
    COLOR_DARK_GREY  = (50, 50, 50)
    COLOR_GREEN      = (0, 200, 100)
    COLOR_LIGHT_GREY = (200, 200, 200)
    COLOR_MID_GREY   = (80, 80, 80)
    COLOR_TEXT       = (60, 60, 60)

    # Bio completa hardcoded (più ricca di quella dal DB)
    BIO_COMPLETA = (
        "I Superfluido sono un collettivo hip hop indipendente nato a Roma nel 2021. "
        "La formazione e' composta da sette elementi che, pur provenendo da realta' e background differenti, "
        "condividono la medesima visione e lo stesso approccio alla produzione musicale. "
        "Il gruppo schiera al microfono i cinque MC Eric Draven, Martire, gg.Proiettili, NONe e Slam aka Hysteriack, "
        "supportati dalle produzioni di Leony47 e Giord. Tratto distintivo e punto di forza del collettivo e' "
        "la totale indipendenza e la cura artigianale del suono: i Superfluido si occupano in prima persona "
        "del mixaggio e del master di ogni loro singolo progetto, arrivando spesso a curare la qualita' del suono "
        "anche per lavori di artisti esterni. Sin dal loro esordio, hanno costruito una solida attivita' live "
        "che li ha portati a esibirsi in numerose citta' italiane, tra cui Roma, Lecce, Torino, Bologna e Arezzo, "
        "vantando inoltre diverse collaborazioni internazionali. La loro forte attitudine dal vivo ha permesso "
        "loro di condividere il palco con Rome Streetz, Kaos One, DJ Gruff, Egreen, Radici Nel Cemento e Gianni Bismark. "
        "Il collettivo si distingue per una discografia prolifica che alterna progetti corali a EP e dischi dei singoli membri. "
        "Tra le release piu' rappresentative: 'STILE' (2023), 'GATTO6' e 'OMBRELLO NERO' di Hysteriack, "
        "'LILIENFELD' di NONe ed Eric Draven (2024), 'VITA SEGRETA DELLE PIANTE' di Eric Draven (2024) "
        "e il recente 'LA VITA E' UN DONO' (2024), realizzato con la Kiazza Mob. "
        "I Superfluido sono stati recensiti da Rapologia, Rapmaniacz, Zero, La Nazione e Il Quotidiano di Puglia."
    )

    def clean(text):
        if not text:
            return ""
        return str(text).encode('latin-1', 'ignore').decode('latin-1')

    def sezione(titolo):
        """Stampa separatore + titolo di sezione."""
        pdf.ln(4)
        pdf.set_draw_color(*COLOR_LIGHT_GREY)
        pdf.set_line_width(0.3)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        pdf.set_text_color(*COLOR_DARK_GREY)
        pdf.set_font("Helvetica", "B", 15)
        pdf.cell(0, 9, titolo, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    # ════════════════════════════════════════════════════════════════════════
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── HEADER: banner scuro ─────────────────────────────────────────────────
    banner_y = pdf.get_y()
    pdf.set_fill_color(*COLOR_DARK_GREY)
    pdf.rect(10, banner_y, 190, 28, style="F")

    pdf.set_y(banner_y + 3)
    pdf.set_text_color(*COLOR_GREEN)
    pdf.set_font("Helvetica", "B", 26)
    pdf.cell(0, 12, "SUPERFLUIDO", align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "I", 11)
    pdf.set_text_color(220, 220, 220)
    pdf.cell(0, 7, clean(f"OFFICIAL PRESS KIT & TECH RIDER  -  {tipo_evento}"), align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)

    # ── 1. CHI SIAMO ─────────────────────────────────────────────────────────
    sezione("1. CHI SIAMO")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*COLOR_TEXT)
    pdf.multi_cell(0, 5, clean(BIO_COMPLETA))
    pdf.ln(4)

    # ── 2. LINEUP ────────────────────────────────────────────────────────────
    sezione("2. LINEUP")
    for membro in dati_selezionati:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*COLOR_DARK_GREY)
        pdf.cell(0, 7, clean(membro.get('nome_arte', '')), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*COLOR_MID_GREY)
        pdf.multi_cell(0, 5, clean(membro.get('bio_breve') or membro.get('bio') or 'Nessuna bio disponibile.'))
        pdf.ln(3)
    pdf.ln(2)

    # ── 3. TECHNICAL RIDER ───────────────────────────────────────────────────
    sezione("3. TECHNICAL RIDER")
    for membro in dati_selezionati:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*COLOR_DARK_GREY)
        nome = clean(membro.get('nome_arte', ''))
        pdf.cell(0, 7, nome, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*COLOR_TEXT)
        strumentazione = membro.get('strumentazione') or 'Non specificata'
        for voce in [s.strip() for s in strumentazione.split(',') if s.strip()]:
            pdf.cell(8, 5, "", new_x="RIGHT", new_y="TOP")  # indentazione
            pdf.cell(0, 5, clean(f"- {voce}"), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
    pdf.ln(2)

    # ── 4. HOSPITALITY & CACHET (riquadro) ────────────────────────────────────
    sezione("4. HOSPITALITY & CACHET")

    box_y = pdf.get_y()
    box_h = 42
    pdf.set_fill_color(245, 245, 245)
    pdf.set_draw_color(*COLOR_LIGHT_GREY)
    pdf.set_line_width(0.4)
    pdf.rect(10, box_y, 190, box_h, style="DF")

    pdf.set_y(box_y + 4)
    pdf.set_x(15)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*COLOR_DARK_GREY)
    pdf.cell(35, 6, "Cachet:", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*COLOR_TEXT)
    pdf.cell(0, 6, "Trattativa Riservata (Da richiedere in privato).", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(3)
    pdf.set_x(15)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*COLOR_DARK_GREY)
    pdf.cell(35, 6, "Backstage:", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*COLOR_TEXT)
    pdf.cell(0, 6, clean(
        f"Accesso richiesto. Min. {bottiglie_acqua} bottiglie d'acqua grandi "
        f"(2 per persona, {num_persone} elementi)."
    ), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(3)
    pdf.set_x(15)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*COLOR_DARK_GREY)
    pdf.cell(35, 6, "Email:", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(*COLOR_TEXT)
    pdf.cell(0, 6, clean(email_superfluido or "superfluido@gmail.com"), new_x="LMARGIN", new_y="NEXT")

    # ── FOOTER ───────────────────────────────────────────────────────────────
    pdf.ln(14)
    pdf.set_draw_color(*COLOR_LIGHT_GREY)
    pdf.set_line_width(0.3)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(0, 6, "Press Kit generato da SUPERFLUIDO AI  (c) 2026  -  www.superfluido.com", align="C", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def presskit_page():
    """Generazione Press Kit PDF e Vault documenti a cartelle."""
    st.title("🤖 Press-Kit AI & Vault")
    st.write("Genera press kit professionali per i tuoi eventi e accedi all'archivio cloud di documenti.")
    st.divider()

    tab_generator, tab_vault = st.tabs(["📝 Generatore AI", "🗃️ Il Vault"])

    # ==================== TAB 1: GENERATORE AI ====================
    with tab_generator:
        st.subheader("📝 Generatore Press-Kit")

        try:
            tutti_profili = db.get_all_profiles()
            profilo_superfluido = next((p for p in tutti_profili if p.get('nome_arte', '').upper() == 'SUPERFLUIDO'), None)
            nomi_artisti = [p.get('nome_arte') for p in tutti_profili if p.get('nome_arte') and p.get('nome_arte').upper() != 'SUPERFLUIDO']
        except Exception:
            nomi_artisti = []
            profilo_superfluido = None
            st.warning("⚠️ Errore nel caricamento dei profili")

        if not nomi_artisti:
            st.info("📭 Nessun profilo disponibile. Crea almeno un profilo artista prima di generare un press kit.")
        else:
            st.write("**Seleziona i membri presenti all'evento:**")
            cols = st.columns(3)
            membri_selezionati = []
            for idx, artista in enumerate(nomi_artisti):
                with cols[idx % 3]:
                    if st.checkbox(artista, key=f"checkbox_artista_{idx}"):
                        membri_selezionati.append(artista)

            st.write("")
            tipo_evento = st.text_input(
                "Tipo di Evento",
                placeholder="Es: Live Club, Intervista Radio, Festival, Sessione Studio",
                key="tipo_evento_input"
            )
            st.write("")

            if st.button("✨ Genera e Salva in PDF", type="primary", width="stretch"):
                if not membri_selezionati:
                    st.error("❌ Seleziona almeno un membro")
                elif not tipo_evento:
                    st.error("❌ Specifica il tipo di evento")
                else:
                        # ── Raccolta dati membri ─────────────────────────────
                        dati_selezionati = []
                        strumentazione_totale = []
                        for profilo in tutti_profili:
                            if profilo.get('nome_arte') in membri_selezionati:
                                dati_selezionati.append({
                                    'nome_arte': profilo.get('nome_arte'),
                                    'bio_breve': profilo.get('bio_breve', 'N/A'),
                                    'bio': profilo.get('bio_breve', 'N/A'),
                                    'strumentazione': profilo.get('strumentazione', 'N/A')
                                })
                                if profilo.get('strumentazione'):
                                    strumentazione_totale.append(profilo.get('strumentazione'))

                        num_persone = len(membri_selezionati)
                        bottiglie_acqua = num_persone * 2
                        strumentazione_combinata = ", ".join(strumentazione_totale) if strumentazione_totale else "Non specificata"
                        email_superfluido = profilo_superfluido.get('email_contatto', 'superfluido@gmail.com') if profilo_superfluido else 'superfluido@gmail.com'
                        bio_superfluido = profilo_superfluido.get('bio_breve', '') if profilo_superfluido else ''

                        # ── Bio fissa ufficiale ───────────────────────────────
                        bio_completa = (
                            "I Superfluido sono un collettivo hip hop indipendente nato a Roma nel 2021. "
                            "La formazione e' composta da sette elementi che, pur provenendo da realta' e "
                            "background differenti, condividono la medesima visione e lo stesso approccio "
                            "alla produzione musicale. Il gruppo schiera al microfono i cinque MC Eric Draven, "
                            "Martire, gg.Proiettili, NONe e Slam aka Hysteriack, supportati dalle produzioni "
                            "di Leony47 e Giord.\n\n"
                            "Tratto distintivo e punto di forza del collettivo e' la totale indipendenza e la "
                            "cura artigianale del suono: i Superfluido si occupano in prima persona del mixaggio "
                            "e del master di ogni loro singolo progetto, arrivando spesso a curare la qualita' "
                            "del suono anche per lavori di artisti esterni. Sin dal loro esordio, hanno costruito "
                            "una solida attivita' live che li ha portati a esibirsi in numerose citta' italiane, "
                            "tra cui Roma, Lecce, Torino, Bologna e Arezzo, vantando collaborazioni internazionali "
                            "e l'apertura di concerti per artisti come Rome Streetz, Kaos One, DJ Gruff e Gianni Bismark.\n\n"
                            "Tra le release piu' rappresentative: 'STILE' (2023), 'GATTO6', 'OMBRELLO NERO', "
                            "'LILIENFELD' e il recente progetto corale 'LA VITA E UN DONO' (2024), "
                            "realizzato a quattro mani con la Kiazza Mob."
                        )

                        # ── Preview Streamlit ─────────────────────────────────
                        with st.container(border=True):
                            st.markdown("# 🎤 PRESS KIT: SUPERFLUIDO")
                            st.divider()
                            st.subheader("1. CHI SIAMO")
                            st.write(bio_completa)
                            st.divider()
                            st.subheader(f"2. LA LINEUP DI STASERA: {tipo_evento}")
                            for artista in dati_selezionati:
                                with st.container(border=True):
                                    st.markdown(f"### 🎤 {artista['nome_arte']}")
                                    st.write(artista['bio'])
                            st.divider()
                            st.subheader("3. TECHNICAL RIDER")
                            for artista in dati_selezionati:
                                st.markdown(f"**{artista['nome_arte']}:** {artista.get('strumentazione', 'N/A')}")
                            st.divider()
                            st.subheader("4. HOSPITALITY & INFO")
                            st.write(
                                f"Backstage richiesto. Almeno **{bottiglie_acqua} bottiglie d'acqua** "
                                f"({num_persone} elementi)."
                            )
                            st.write(f"**Cachet:** Trattativa Riservata  |  **Email:** {email_superfluido}")
                            st.divider()
                            st.caption("*Press Kit generato da SUPERFLUIDO © 2026*")

                        st.write("")

                        # ── Genera PDF (BandcampPDF dark mode) e carica nel Vault ──
                        try:
                            with st.spinner("📄 Generazione PDF in corso..."):

                                def clean(text):
                                    if not text: return ""
                                    return str(text).encode('latin-1', 'ignore').decode('latin-1')

                                class BandcampPDF(FPDF):
                                    def header(self):
                                        self.set_fill_color(26, 26, 26)
                                        self.rect(0, 0, 210, 297, 'F')

                                COL_ORANGE = (255, 107, 53)
                                COL_WHITE  = (240, 240, 240)
                                COL_GREY   = (150, 150, 150)

                                pdf = BandcampPDF()
                                pdf.add_page()
                                pdf.set_auto_page_break(auto=True, margin=15)

                                # Header
                                pdf.set_y(20)
                                pdf.set_font("Helvetica", 'B', 32)
                                pdf.set_text_color(*COL_WHITE)
                                pdf.cell(0, 10, "SUPERFLUIDO", align='C', new_x="LMARGIN", new_y="NEXT")
                                pdf.ln(2)
                                pdf.set_font("Helvetica", 'I', 12)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(0, 8, clean("OFFICIAL PRESS KIT & TECH RIDER - " + tipo_evento.upper()), align='C', new_x="LMARGIN", new_y="NEXT")
                                pdf.set_draw_color(*COL_ORANGE)
                                pdf.set_line_width(0.8)
                                pdf.line(10, pdf.get_y() + 2, 200, pdf.get_y() + 2)

                                # 1. CHI SIAMO
                                pdf.ln(10)
                                pdf.set_font("Helvetica", 'B', 16)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(0, 10, "1. CHI SIAMO", new_x="LMARGIN", new_y="NEXT")
                                pdf.set_font("Helvetica", '', 11)
                                pdf.set_text_color(*COL_WHITE)
                                pdf.multi_cell(0, 6, clean(bio_completa))

                                # 2. LINEUP
                                pdf.ln(10)
                                pdf.set_font("Helvetica", 'B', 16)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(0, 10, "2. LINEUP", new_x="LMARGIN", new_y="NEXT")
                                pdf.ln(2)
                                for membro in dati_selezionati:
                                    pdf.set_font("Helvetica", 'B', 13)
                                    pdf.set_text_color(*COL_ORANGE)
                                    pdf.cell(0, 8, clean(membro['nome_arte']), new_x="LMARGIN", new_y="NEXT")
                                    pdf.set_font("Helvetica", '', 10)
                                    pdf.set_text_color(*COL_WHITE)
                                    pdf.multi_cell(0, 5, clean(membro.get('bio_breve') or 'Nessuna bio disponibile.'))
                                    pdf.ln(4)

                                # 3. TECH RIDER
                                pdf.ln(6)
                                pdf.set_draw_color(*COL_ORANGE)
                                pdf.set_line_width(0.5)
                                pdf.line(10, pdf.get_y(), 200, pdf.get_y())
                                pdf.ln(5)
                                pdf.set_font("Helvetica", 'B', 16)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(0, 10, "3. TECHNICAL RIDER", new_x="LMARGIN", new_y="NEXT")
                                pdf.ln(2)
                                for membro in dati_selezionati:
                                    pdf.set_font("Helvetica", 'B', 12)
                                    pdf.set_text_color(*COL_WHITE)
                                    pdf.cell(0, 6, clean(membro['nome_arte']), new_x="LMARGIN", new_y="NEXT")
                                    pdf.set_font("Helvetica", '', 10)
                                    pdf.set_text_color(*COL_GREY)
                                    strm = membro.get('strumentazione') or 'Non specificata'
                                    pdf.multi_cell(0, 5, clean("- " + strm))
                                    pdf.ln(3)

                                # 4. HOSPITALITY
                                pdf.ln(6)
                                pdf.set_font("Helvetica", 'B', 16)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(0, 10, "4. HOSPITALITY & INFO", new_x="LMARGIN", new_y="NEXT")
                                pdf.ln(2)
                                pdf.set_font("Helvetica", 'B', 11)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(40, 8, "Cachet:", new_x="RIGHT", new_y="TOP")
                                pdf.set_font("Helvetica", '', 11)
                                pdf.set_text_color(*COL_WHITE)
                                pdf.cell(0, 8, "Trattativa Riservata", new_x="LMARGIN", new_y="NEXT")
                                pdf.set_font("Helvetica", 'B', 11)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(40, 8, "Backstage:", new_x="RIGHT", new_y="TOP")
                                pdf.set_font("Helvetica", '', 11)
                                pdf.set_text_color(*COL_WHITE)
                                pdf.cell(0, 8, clean(f"Min. {bottiglie_acqua} bottiglie d'acqua ({num_persone} elementi)."), new_x="LMARGIN", new_y="NEXT")
                                pdf.set_font("Helvetica", 'B', 11)
                                pdf.set_text_color(*COL_ORANGE)
                                pdf.cell(40, 8, "Email:", new_x="RIGHT", new_y="TOP")
                                pdf.set_font("Helvetica", '', 11)
                                pdf.set_text_color(*COL_WHITE)
                                pdf.cell(0, 8, clean(email_superfluido), new_x="LMARGIN", new_y="NEXT")

                                pdf_bytes = bytes(pdf.output())

                            nome_pdf = f"PressKit_{tipo_evento.replace(' ', '_')}.pdf"
                            percorso_storage = f"vault/presskits/{uuid.uuid4()}_{nome_pdf}"

                            if db.upload_file_to_storage('superfluido_bucket', percorso_storage, pdf_bytes):
                                url_pubblico = db.get_public_url('superfluido_bucket', percorso_storage)
                                cartelle_attuali = db.get_vault_folders()
                                if 'Press Kits' not in cartelle_attuali:
                                    db.create_vault_folder('Press Kits', st.session_state.user.id)
                                db.save_vault_file(nome_pdf, 'Press Kits', url_pubblico, st.session_state.user.id)
                                st.success("✅ PDF Generato e salvato nel Vault!")
                            else:
                                st.error("❌ Errore nel salvataggio su Supabase")

                            st.download_button(
                                label="📥 Scarica PDF ora",
                                data=pdf_bytes,
                                file_name=nome_pdf,
                                mime="application/pdf",
                                width="stretch"
                            )
                        except Exception as e:
                            st.error(f"❌ Errore generazione PDF: {str(e)}")

    # ==================== TAB 2: IL VAULT ====================
    with tab_vault:

        # Inizializza session state
        if 'cartella_selezionata' not in st.session_state:
            st.session_state.cartella_selezionata = 'Generale'

        try:
            cartelle_list = db.get_vault_folders()
            tutti_files = db.get_vault_files()
        except Exception:
            cartelle_list = ['Generale']
            tutti_files = []
            st.warning("⚠️ Errore nel caricamento del Vault")

        if 'Generale' not in cartelle_list:
            cartelle_list = ['Generale'] + cartelle_list

        col_nav, col_files = st.columns([1, 3])

        # ---- BARRA LATERALE CARTELLE ----
        with col_nav:
            st.markdown("**📁 Cartelle**")
            st.write("")

            for cartella_nome in cartelle_list:
                icona = "📂" if cartella_nome == st.session_state.cartella_selezionata else "📁"
                tipo_btn = "primary" if cartella_nome == st.session_state.cartella_selezionata else "secondary"
                if st.button(
                    f"{icona} {cartella_nome}",
                    key=f"nav_{cartella_nome}",
                    use_container_width=True,
                    type=tipo_btn
                ):
                    st.session_state.cartella_selezionata = cartella_nome
                    st.rerun()

            st.divider()

            with st.popover("➕ Nuova Cartella", use_container_width=True):
                nome_nuova = st.text_input("Nome cartella", placeholder="Es: Contratti, Foto...", key="nome_nuova_cartella")
                if st.button("✅ Crea", key="btn_crea_cartella", type="primary"):
                    if nome_nuova.strip():
                        if db.create_vault_folder(nome_nuova.strip(), st.session_state.user.id):
                            st.session_state.cartella_selezionata = nome_nuova.strip()
                            st.rerun()
                        else:
                            st.error("❌ Errore nella creazione")
                    else:
                        st.error("❌ Inserisci un nome")

            if st.session_state.cartella_selezionata != 'Generale':
                st.write("")
                if st.button(
                    "🗑️ Elimina Cartella",
                    key="btn_elimina_cartella",
                    use_container_width=True,
                    help="I file vengono spostati in Generale"
                ):
                    db.delete_vault_folder(st.session_state.cartella_selezionata)
                    st.session_state.cartella_selezionata = 'Generale'
                    st.rerun()

        # ---- CONTENUTO CARTELLA ----
        with col_files:
            col_header, col_upload_btn = st.columns([3, 1])

            with col_header:
                st.subheader(f"📂 {st.session_state.cartella_selezionata}")

            with col_upload_btn:
                st.write("")
                with st.popover("📤 Carica File Qui", use_container_width=True):
                    file_da_caricare = st.file_uploader("Seleziona file", key="vault_file_uploader")
                    if st.button("⬆️ Carica", key="btn_carica_file", type="primary"):
                        if file_da_caricare is None:
                            st.error("❌ Seleziona un file")
                        else:
                            with st.spinner("Caricamento..."):
                                nome_clean = db.sanitize_filename(file_da_caricare.name)
                                percorso = f"vault/generale/{uuid.uuid4()}_{nome_clean}"
                                if db.upload_file_to_storage('superfluido_bucket', percorso, file_da_caricare.getvalue()):
                                    url = db.get_public_url('superfluido_bucket', percorso)
                                    db.save_vault_file(
                                        file_da_caricare.name,
                                        st.session_state.cartella_selezionata,
                                        url,
                                        st.session_state.user.id
                                    )
                                    st.success("✅ Caricato!")
                                    st.rerun()
                                else:
                                    st.error("❌ Errore upload")

            st.divider()

            files_cartella = [f for f in tutti_files if f.get('cartella') == st.session_state.cartella_selezionata]

            if not files_cartella:
                st.info(f"📭 Nessun file in '{st.session_state.cartella_selezionata}'. Carica il primo!")
            else:
                altre_cartelle = [c for c in cartelle_list if c != st.session_state.cartella_selezionata]

                for file_info in files_cartella:
                    file_id = file_info.get('id')
                    file_url = file_info.get('file_url', '')

                    with st.container(border=True):
                        col_nome, col_dl, col_sposta, col_del = st.columns([3.5, 1, 1.2, 0.5])

                        with col_nome:
                            st.markdown(f"📄 **{file_info.get('nome_file', 'N/A')}**")
                            data = file_info.get('created_at', '')
                            if data:
                                st.caption(f"🕒 {data[:10]}")

                        with col_dl:
                            if file_url:
                                st.link_button("⬇️ Scarica", file_url, use_container_width=True)

                        with col_sposta:
                            if altre_cartelle:
                                with st.popover("Sposta ➡️", use_container_width=True):
                                    dest = st.selectbox(
                                        "Destinazione",
                                        altre_cartelle,
                                        key=f"sposta_sel_{file_id}"
                                    )
                                    if st.button("✅ Conferma", key=f"sposta_btn_{file_id}", type="primary"):
                                        db.move_vault_file(file_id, dest)
                                        st.rerun()

                        with col_del:
                            if st.button("🗑️", key=f"del_{file_id}", help="Elimina file"):
                                try:
                                    bucket_prefix = "/storage/v1/object/public/superfluido_bucket/"
                                    file_path = file_url.split(bucket_prefix)[-1] if bucket_prefix in file_url else ""
                                    db.delete_vault_file(file_id, file_path)
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"❌ {str(e)}")


def profilo_page():
    """Gestione profilo artista con visualizzazione condivisa e modifica personale"""
    st.title("👤 I Profili di SUPERFLUIDO")
    st.divider()
    
    user_id = st.session_state.user.id
    
    # Recupera profilo dell'utente corrente
    profilo_attuale = db.get_user_profile(user_id)
    if profilo_attuale is None:
        profilo_attuale = {}
    
    tab_collettivo, tab_modifica = st.tabs(["👥 Il Collettivo", "⚙️ Modifica il mio Profilo"])
    
    # ==================== TAB 1: IL COLLETTIVO (VISUALIZZAZIONE CONDIVISA) ====================
    with tab_collettivo:
        st.write("Scopri i tuoi compagni di SUPERFLUIDO e i loro profili.")
        st.divider()
        
        try:
            tutti_profili = db.get_all_profiles()
            
            if not tutti_profili or not any(p.get('nome_arte') for p in tutti_profili):
                st.info("📭 Nessun profilo configurato ancora nel collettivo.")
            else:
                # Filtra solo i profili con nome_arte compilato
                profili_validi = [p for p in tutti_profili if p.get('nome_arte')]
                
                # Layout a griglia (2 colonne)
                cols = st.columns(2)
                
                for idx, profilo in enumerate(profili_validi):
                    with cols[idx % 2]:
                        with st.container(border=True):
                            # Header con foto e nome
                            col_img, col_nome = st.columns([1, 2.5])
                            
                            with col_img:
                                profile_picture_url = profilo.get('profile_picture_url')
                                
                                if profile_picture_url:
                                    st.markdown(f"""
                                        <div style='
                                            width: 60px;
                                            height: 60px;
                                            border-radius: 50%;
                                            overflow: hidden;
                                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                                        '>
                                            <img src="{profile_picture_url}" style='
                                                width: 100%;
                                                height: 100%;
                                                object-fit: cover;
                                            '>
                                        </div>
                                    """, unsafe_allow_html=True)
                                else:
                                    nome_arte = profilo.get('nome_arte', 'U')
                                    iniziale = nome_arte[0].upper() if nome_arte else 'U'
                                    st.markdown(f"""
                                        <div style='
                                            width: 60px;
                                            height: 60px;
                                            border-radius: 50%;
                                            background: linear-gradient(135deg, #FF6B35 0%, #FF8555 100%);
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            font-size: 1.5rem;
                                            font-weight: 800;
                                            color: white;
                                        '>
                                            {iniziale}
                                        </div>
                                    """, unsafe_allow_html=True)
                            
                            with col_nome:
                                st.markdown(f"**{profilo.get('nome_arte', 'N/A')}**")
                            
                            st.divider()
                            
                            # Bio
                            bio = profilo.get('bio_breve', '')
                            if bio:
                                st.caption(f"📝 {bio}")
                            
                            # Strumentazione
                            strumentazione = profilo.get('strumentazione', '')
                            if strumentazione:
                                st.caption(f"🎸 {strumentazione}")
                            
                            # Contatti Social
                            email_contatto = profilo.get('email_contatto', '')
                            link_instagram = profilo.get('link_instagram', '')
                            link_spotify = profilo.get('link_spotify', '')
                            if email_contatto:
                                st.caption(f"📧 {email_contatto}")
                            if link_instagram:
                                st.markdown(f"[📸 Instagram]({link_instagram})")
                            if link_spotify:
                                st.markdown(f"[🎵 Spotify]({link_spotify})")
        
        except Exception as e:
            st.error(f"❌ Errore nel caricamento dei profili: {str(e)}")
    
    # ==================== TAB 2: MODIFICA IL MIO PROFILO ====================
    with tab_modifica:
        st.subheader("⚙️ Modifica il mio Profilo")
        
        with st.form("profilo_form"):
            nome_arte = st.text_input(
                "Nome d'Arte",
                value=profilo_attuale.get('nome_arte', ''),
                placeholder="Es: SLAM, gg.proiettili, Leony47"
            )
            
            st.write("")
            
            st.markdown("**📸 Foto Profilo**")
            foto_profilo = st.file_uploader(
                "Seleziona immagine",
                type=["jpg", "png", "jpeg"],
                key="profile_pic_upload",
                label_visibility="collapsed"
            )
            
            if foto_profilo:
                st.caption(f"✅ {foto_profilo.name}")
            
            st.write("")
            
            strumentazione = st.text_area(
                "🎸 Strumentazione Live",
                value=profilo_attuale.get('strumentazione', ''),
                placeholder="Es: Voce principale, Akai MPC One, Synth Moog, Mixer",
                height=80
            )
            
            st.write("")
            
            is_superfluido = profilo_attuale.get('nome_arte', '').upper() == 'SUPERFLUIDO'
            bio_breve = st.text_area(
                "📝 Bio Breve" + ("" if is_superfluido else " (max 500 caratteri)"),
                value=profilo_attuale.get('bio_breve', ''),
                placeholder="Descrivi il tuo stile e la tua musica...",
                height=100,
                max_chars=None if is_superfluido else 500
            )
            
            st.write("")
            
            email_contatto = st.text_input(
                "📧 Email di Contatto",
                value=profilo_attuale.get('email_contatto', ''),
                placeholder="Es: tuonome@gmail.com"
            )
            
            st.write("")
            
            link_instagram = st.text_input(
                "📸 Link Instagram",
                value=profilo_attuale.get('link_instagram', ''),
                placeholder="Es: https://instagram.com/tuonome"
            )
            
            st.write("")
            
            link_spotify = st.text_input(
                "🎵 Link Spotify",
                value=profilo_attuale.get('link_spotify', ''),
                placeholder="Es: https://open.spotify.com/artist/..."
            )
            
            st.write("")
            
            if st.form_submit_button("💾 Salva Profilo", type="primary", width="stretch"):
                if not nome_arte:
                    st.error("❌ Inserisci il nome d'arte")
                else:
                    try:
                        with st.spinner("Salvataggio..."):
                            # Upload foto se nuova
                            foto_url = profilo_attuale.get('profile_picture_url', None)
                            
                            if foto_profilo is not None:
                                # Sanitizza nome file
                                foto_name_clean = db.sanitize_filename(foto_profilo.name)
                                foto_path = f"profiles/{uuid.uuid4()}_{foto_name_clean}"
                                
                                # Upload a Storage
                                if db.upload_file_to_storage('superfluido_bucket', foto_path, foto_profilo.getvalue()):
                                    foto_url = db.get_public_url('superfluido_bucket', foto_path)
                                else:
                                    st.error("❌ Errore nell'upload della foto")
                                    foto_url = profilo_attuale.get('profile_picture_url', None)
                            
                            # Upsert profilo
                            result = db.upsert_user_profile(
                                user_id,
                                nome_arte,
                                strumentazione,
                                bio_breve,
                                email_contatto,
                                link_instagram,
                                link_spotify,
                                foto_url
                            )
                            
                            if result:
                                st.success("✅ Profilo salvato con successo!")
                                st.rerun()
                            else:
                                st.error("❌ Errore nel salvataggio del profilo")
                    
                    except Exception as e:
                        st.error(f"❌ Errore: {str(e)}")

def calendario_page():
    st.title("🗓️ Calendario SUPERFLUIDO")
    st.divider()

    user_id   = str(st.session_state.user.id)
    is_master = (st.session_state.role == "master")

    tab_cal, tab_lista = st.tabs(["📅 Vista Calendario", "📝 Elenco Eventi"])

    # ── Carica eventi una volta sola ─────────────────────────────────────
    eventi_raw = db.get_all_events()

    # ════════════════════════════════════════════════════════════════════
    # TAB 1 – Widget FullCalendar + Form creazione
    # ════════════════════════════════════════════════════════════════════
    with tab_cal:
        col_cal, col_info = st.columns([2, 1])

        with col_cal:
            cal_events = []
            for e in eventi_raw:
                ev = {
                    "title": f"[{e['tipo_evento']}] {e['titolo']}",
                    "start": e['data_evento'],
                    "color": e.get('colore', '#FF6B35'),
                    "id": str(e['id'])
                }
                if e.get('data_fine'):
                    ev["end"] = e['data_fine']
                cal_events.append(ev)

            cal_options = {
                "initialView": "dayGridMonth",
                "timeZone": "Europe/Rome",
                "headerToolbar": {
                    "left": "prev,next today",
                    "center": "title",
                    "right": "dayGridMonth,dayGridWeek"
                },
                "selectable": True,
                "height": 550,
            }
            st_calendar(events=cal_events, options=cal_options, key="superfluido_full_calendar")

        with col_info:
            st.subheader("➕ Aggiungi Evento")
            with st.form("nuovo_evento"):
                titolo = st.text_input("Nome Evento")
                tipo   = st.selectbox("Tipo", ["Live", "Intervista", "Sessione Studio", "Release"])

                r1c1, r1c2 = st.columns(2)
                data_inizio = r1c1.date_input("Data Inizio")
                ora_inizio  = r1c2.time_input("Ora Inizio")

                r2c1, r2c2 = st.columns(2)
                data_fine_d = r2c1.date_input("Data Fine")
                ora_fine    = r2c2.time_input("Ora Fine")

                luogo  = st.text_input("Luogo")
                note   = st.text_area("Note", height=80)
                colore = st.color_picker("Colore", "#FF6B35")

                if st.form_submit_button("📌 Registra Data", use_container_width=True):
                    if not titolo:
                        st.warning("⚠️ Inserisci il nome dell'evento")
                    else:
                        dt_inizio = datetime.combine(data_inizio, ora_inizio).replace(tzinfo=ROME_TZ)
                        dt_fine   = datetime.combine(data_fine_d, ora_fine).replace(tzinfo=ROME_TZ)
                        if dt_fine < dt_inizio:
                            st.error("❌ La data di fine non può essere precedente a quella di inizio")
                        else:
                            db.create_event(
                                user_id, titolo, tipo,
                                dt_inizio, dt_fine,
                                luogo, note, [], colore
                            )
                            st.success("✅ Evento creato!")
                            st.rerun()

    # ════════════════════════════════════════════════════════════════════
    # TAB 2 – Lista stile iPhone Reminders
    # ════════════════════════════════════════════════════════════════════
    with tab_lista:
        if not eventi_raw:
            st.info("📭 Nessun evento presente.")
        else:
            for e in eventi_raw:
                colore_ev = e.get('colore') or '#FF6B35'
                can_delete = is_master or e.get('creato_da') == user_id

                # Formattazione orari
                try:
                    dt_i = datetime.fromisoformat(e['data_evento'].replace('Z', '+00:00')).astimezone(ROME_TZ)
                    orario_str = dt_i.strftime('%d %b %Y  %H:%M')
                    if e.get('data_fine'):
                        dt_f = datetime.fromisoformat(e['data_fine'].replace('Z', '+00:00')).astimezone(ROME_TZ)
                        orario_str += f" → {dt_f.strftime('%H:%M')}"
                except Exception:
                    orario_str = e.get('data_evento', '')

                c_card, c_btn = st.columns([9, 1])
                with c_card:
                    st.markdown(
                        f"""
                        <div style="display:flex; align-items:center; gap:14px;
                                    padding:12px 16px; border-radius:12px;
                                    background:rgba(255,255,255,0.04);
                                    border:1px solid rgba(255,255,255,0.07);
                                    margin-bottom:6px;">
                            <div style="width:6px; height:52px; border-radius:4px;
                                        background:{colore_ev}; flex-shrink:0;"></div>
                            <div>
                                <div style="font-weight:700; font-size:1rem;">{e['titolo']}</div>
                                <div style="color:#aaa; font-size:0.82rem;">
                                    {e.get('tipo_evento','—')} &nbsp;·&nbsp; {orario_str}
                                </div>
                                <div style="color:#888; font-size:0.8rem;">
                                    📍 {e.get('luogo') or 'Location non definita'}
                                </div>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                with c_btn:
                    st.markdown('<div style="margin-top:14px;"></div>', unsafe_allow_html=True)
                    if can_delete:
                        if st.button("🗑️", key=f"del_{e['id']}"):
                            db.delete_event(e['id'], user_id, is_master)
                            st.rerun()

def main():
    """App principale con Top Navigation Bar integrata."""

    if st.session_state.user is None:
        st.markdown("""
            <style>
                /* Nasconde header */
                header { visibility: hidden !important; }

                /* Rimuove padding superiore eccessivo */
                .main .block-container {
                    padding-top: 2rem !important;
                }

                /* Uccide lo zoom del logo */
                [data-testid="stImage"] {
                    pointer-events: none !important;
                }
                button[title="Enlarge image"] {
                    display: none !important;
                }

                /* Stile Box di Login */
                [data-testid="stForm"] {
                    background: rgba(10, 10, 10, 0.85) !important;
                    border: 1px solid rgba(255, 107, 53, 0.3) !important;
                    border-radius: 15px !important;
                    padding: 30px !important;
                }
            </style>
        """, unsafe_allow_html=True)
        login_page()
    else:
        # ════════════════════════════════════════════════════════════════════
        # TOP NAVBAR INTEGRATA (Logout incluso nel menu)
        # ════════════════════════════════════════════════════════════════════
        menu_options = ["Home", "Magazzino", "Calendario"]
        menu_icons   = ["house", "box-seam", "calendar3"]

        if st.session_state.role in ["master", "membro"]:
            menu_options.append("Progetti")
            menu_icons.append("headphones")

        menu_options += ["Press-Kit", "Profilo", "Esci"]
        menu_icons   += ["robot", "person-circle", "door-open"]

        scelta = option_menu(
            menu_title=None,
            options=menu_options,
            icons=menu_icons,
            default_index=0,
            orientation="horizontal",
            styles={
                "container": {"padding": "0!important", "background-color": "transparent", "max-width": "100%"},
                "icon": {"color": "#FF6B35", "font-size": "16px"},
                "nav-link": {
                    "font-size": "14px",
                    "font-weight": "600",
                    "color": "#ccc",
                    "padding": "10px 15px",
                    "border-radius": "0px",
                    "--hover-color": "rgba(255,107,53,0.1)",
                },
                "nav-link-selected": {
                    "background-color": "#FF6B35",
                    "color": "white",
                    "font-weight": "800",
                },
            }
        )

        # ════════════════════════════════════════════════════════════════════
        # ROUTING & LOGOUT
        # ════════════════════════════════════════════════════════════════════
        if scelta == "Esci":
            st.session_state.clear()
            st.rerun()
        elif scelta == "Home":
            home_page()
        elif scelta == "Magazzino":
            magazzino_page()
        elif scelta == "Calendario":
            calendario_page()
        elif scelta == "Progetti":
            progetti_page()
        elif scelta == "Press-Kit":
            presskit_page()
        elif scelta == "Profilo":
            profilo_page()


if __name__ == "__main__":
    main()
