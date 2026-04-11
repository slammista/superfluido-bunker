import streamlit as st
from supabase import create_client, Client
from datetime import datetime
import requests
import json
import unicodedata
import re

# Connessione a Supabase tramite st.secrets (Streamlit Community Cloud)
url: str = st.secrets["SUPABASE_URL"]
key: str = st.secrets["SUPABASE_KEY"]
supabase: Client = create_client(url, key)

def sanitize_filename(filename):
    """Rimuove caratteri speciali dal nome del file"""
    # Normalizza i caratteri unicode (à -> a, é -> e, etc.)
    filename = unicodedata.normalize('NFKD', filename)
    filename = filename.encode('ascii', 'ignore').decode('ascii')
    # Rimuove caratteri non alfanumerici tranne . - _
    filename = re.sub(r'[^\w\.\-]', '', filename)
    # Rimuove spazi e li sostituisce con underscore
    filename = re.sub(r'\s+', '_', filename)
    return filename

def get_inventory():
    """
    Recupera tutti i prodotti e le relative varianti.
    È l'equivalente Python di una SELECT con JOIN su PL/SQL.
    """
    response = supabase.table("products").select("*, product_variants(*)").execute()
    return response.data

def get_user_role(user_id):
    """Recupera il ruolo dell'utente da Supabase"""
    try:
        response = supabase.table("user_roles").select("role").eq("id", user_id).single().execute()
        if response.data:
            return response.data["role"]
        return None
    except Exception as e:
        print(f"Errore nel recupero del ruolo: {e}")
        return None

# ========== CRUD PROGETTI ==========

# ========== CRUD CALENDARIO ==========

def get_all_events():
    """Recupera tutti gli eventi per il collettivo"""
    try:
        response = supabase.table("eventi_calendario").select("*").order('data_evento').execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Errore recupero eventi: {e}")
        return []

def create_event(user_id, titolo, tipo, d_inizio, d_fine, luogo, note, membri, colore):
    """Crea evento includendo l'orario di fine"""
    try:
        payload = {
            "creato_da": user_id,
            "titolo": titolo,
            "tipo_evento": tipo,
            "data_evento": d_inizio.isoformat(),
            "data_fine": d_fine.isoformat() if d_fine else None,
            "luogo": luogo,
            "note": note,
            "membri_coinvolti": membri,
            "colore": colore
        }
        supabase.table("eventi_calendario").insert(payload).execute()
        return True
    except Exception as e:
        print(f"Errore: {e}")
        return False

def delete_event(event_id, user_id, is_master=False):
    """Elimina un evento se l'utente è master o se ne è il creatore"""
    try:
        query = supabase.table("eventi_calendario").delete().eq("id", event_id)
        if not is_master:
            query = query.eq("creato_da", user_id)
        query.execute()
        return True
    except Exception as e:
        print(f"Errore eliminazione: {e}")
        return False


def get_all_albums(user_id):
    """Recupera tutti gli album dell'utente"""
    try:
        response = supabase.table("album_progetti").select("*").eq("creato_da", user_id).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Errore nel recupero album: {e}")
        return []

def get_all_tracce(user_id):
    """Recupera tutte le tracce dell'utente (join con album)"""
    try:
        response = supabase.table("tracce_audio").select("*, album_progetti(id, nome_album)").eq("caricato_da", user_id).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Errore nel recupero tracce: {e}")
        return []

def create_album(user_id, nome_album, cover_image_url=None):
    """Crea un nuovo album nel DB"""
    try:
        data = {
            "creato_da": user_id,
            "nome_album": nome_album,
            "cover_image_url": cover_image_url
        }
        response = supabase.table("album_progetti").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nella creazione album: {e}")
        return None

def get_album_by_name(user_id, nome_album):
    """Recupera un album per nome"""
    try:
        response = supabase.table("album_progetti").select("*").eq("creato_da", user_id).eq("nome_album", nome_album).single().execute()
        return response.data if response.data else None
    except Exception as e:
        print(f"Errore nel recupero album: {e}")
        return None

def create_traccia(album_id, user_id, nome_traccia, fase, audio_file_url):
    """Crea una nuova traccia nel DB"""
    try:
        data = {
            "album_id": album_id,
            "caricato_da": user_id,
            "nome_traccia": nome_traccia,
            "fase": fase,
            "audio_file_url": audio_file_url
        }
        response = supabase.table("tracce_audio").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nella creazione traccia: {e}")
        return None

def delete_traccia(traccia_id):
    """Elimina una traccia dal DB"""
    try:
        response = supabase.table("tracce_audio").delete().eq("id", traccia_id).execute()
        return True
    except Exception as e:
        print(f"Errore nella cancellazione traccia: {e}")
        return False

def delete_album(album_id):
    """Elimina un album dal DB"""
    try:
        response = supabase.table("album_progetti").delete().eq("id", album_id).execute()
        return True
    except Exception as e:
        print(f"Errore nella cancellazione album: {e}")
        return False

def update_album_name(album_id, nuovo_nome):
    """Aggiorna il nome di un album"""
    try:
        response = supabase.table("album_progetti").update({"nome_album": nuovo_nome}).eq("id", album_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nell'aggiornamento album: {e}")
        return None

def update_album_cover(album_id, cover_url):
    """Aggiorna la copertina di un album"""
    try:
        response = supabase.table("album_progetti").update({"cover_image_url": cover_url}).eq("id", album_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nell'aggiornamento copertina: {e}")
        return None

def update_traccia_name(traccia_id, nuovo_nome):
    """Aggiorna il nome di una traccia"""
    try:
        response = supabase.table("tracce_audio").update({"nome_traccia": nuovo_nome}).eq("id", traccia_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nell'aggiornamento traccia: {e}")
        return None

def upload_file_to_storage(bucket_name, file_path, file_bytes):
    """Upload di un file al storage di Supabase usando REST API"""
    try:
        # Usa l'API REST di Supabase direttamente
        upload_url = f"{url}/storage/v1/object/{bucket_name}/{file_path}"
        
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/octet-stream"
        }
        
        response = requests.post(upload_url, data=file_bytes, headers=headers)
        
        if response.status_code in [200, 201]:
            return True
        else:
            print(f"Errore nell'upload: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"Errore nell'upload: {e}")
        return False

def get_public_url(bucket_name, file_path):
    """Ottiene il link pubblico di un file"""
    try:
        # Costruisci l'URL pubblico direttamente
        public_url = f"{url}/storage/v1/object/public/{bucket_name}/{file_path}"
        return public_url
    except Exception as e:
        print(f"Errore nel recupero URL pubblico: {e}")
        return None

def delete_file_from_storage(bucket_name, file_path):
    """Elimina un file dal storage"""
    try:
        response = supabase.storage.from_(bucket_name).remove([file_path])
        return True
    except Exception as e:
        print(f"Errore nella cancellazione file: {e}")
        return False
def create_product(name, category, price_sell, price_cost):
    """Crea un nuovo prodotto base e restituisce l'ID"""
    try:
        data = {
            "name": name,
            "category": category,
            "base_price_sell": price_sell,
            "base_price_cost": price_cost
        }
        response = supabase.table("products").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Errore nella creazione prodotto: {e}")
        return None

def create_product_variant(product_id, variant_name, stock_quantity):
    """Aggiunge una variante (es. Taglia M) a un prodotto esistente"""
    try:
        data = {
            "product_id": product_id,
            "variant_name": variant_name,
            "stock_quantity": stock_quantity
        }
        response = supabase.table("product_variants").insert(data).execute()
        return True
    except Exception as e:
        print(f"Errore nella creazione variante: {e}")
        return False

def update_variant_stock(variant_id, quantity_sold):
    """Sottrae la quantità venduta dallo stock della variante specifica"""
    try:
        # Recupera lo stock attuale
        current = supabase.table("product_variants").select("stock_quantity").eq("id", variant_id).single().execute()
        
        if not current.data:
            return False
        
        new_stock = current.data["stock_quantity"] - quantity_sold
        
        # Aggiorna il DB
        supabase.table("product_variants").update({"stock_quantity": new_stock}).eq("id", variant_id).execute()
        return True
    except Exception as e:
        print(f"Errore aggiornamento stock: {e}")
        return False

def delete_product(product_id):
    """Elimina un prodotto e tutte le sue varianti"""
    try:
        # Elimina prima tutte le varianti associate
        supabase.table("product_variants").delete().eq("product_id", product_id).execute()
        
        # Elimina il prodotto
        supabase.table("products").delete().eq("id", product_id).execute()
        
        return True
    except Exception as e:
        print(f"Errore nell'eliminazione prodotto: {e}")
        return False
    

def get_user_profile(user_id):
    """Recupera il profilo dell'artista dal database"""
    try:
        response = supabase.table("profili_artisti").select("*").eq("user_id", user_id).single().execute()
        return response.data
    except Exception as e:
        # Se non trova niente (codice PGRST116) significa che il profilo non è ancora stato creato
        return None

def upsert_user_profile(user_id, nome_arte, strumentazione, bio_breve, email_contatto, link_instagram, link_spotify, profile_picture_url=None):
    """Crea o aggiorna il profilo dell'artista (Upsert) con i nuovi campi social"""
    try:
        data = {
            "user_id": user_id,
            "nome_arte": nome_arte,
            "strumentazione": strumentazione,
            "bio_breve": bio_breve,
            "email_contatto": email_contatto,
            "link_instagram": link_instagram,
            "link_spotify": link_spotify
        }
        if profile_picture_url:
            data["profile_picture_url"] = profile_picture_url
            
        response = supabase.table("profili_artisti").upsert(data).execute()
        return True
    except Exception as e:
        print(f"Errore nel salvataggio profilo: {e}")
        return False

def get_all_profiles():
    """Recupera TUTTI i dati di tutti i profili configurati"""
    try:
        response = supabase.table("profili_artisti").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Errore nel recupero di tutti i profili: {e}")
        return []

def list_vault_files(folder="vault"):
    """Elenca i file presenti in una cartella del bucket"""
    try:
        response = supabase.storage.from_('superfluido_bucket').list(folder)
        files = [f for f in response if f['name'] != '.emptyFolderPlaceholder']
        return files
    except Exception as e:
        print(f"Errore lettura Vault: {e}")
        return []

def get_vault_files():
    """Recupera tutti i file del vault"""
    try:
        response = supabase.table("vault_documenti").select("*").order('created_at', desc=True).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Errore recupero vault: {e}")
        return []

def save_vault_file(nome_file, cartella, file_url, user_id):
    """Salva il record di un file nel DB"""
    try:
        data = {
            "nome_file": nome_file,
            "cartella": cartella,
            "file_url": file_url,
            "caricato_da": user_id
        }
        supabase.table("vault_documenti").insert(data).execute()
        return True
    except Exception as e:
        print(f"Errore salvataggio file vault: {e}")
        return False

def delete_vault_file(file_id, file_path):
    """Elimina il file dallo storage e dal DB"""
    try:
        # Elimina da storage
        supabase.storage.from_("superfluido_bucket").remove([file_path])
        # Elimina da DB
        supabase.table("vault_documenti").delete().eq("id", file_id).execute()
        return True
    except Exception as e:
        print(f"Errore cancellazione file vault: {e}")
        return False

def get_vault_folders():
    """Recupera tutte le cartelle create"""
    try:
        response = supabase.table("vault_cartelle").select("*").order('created_at').execute()
        return [f['nome'] for f in response.data] if response.data else ['Generale']
    except Exception as e:
        print(f"Errore recupero cartelle: {e}")
        return ['Generale']

def create_vault_folder(nome_cartella, user_id):
    """Crea una nuova cartella vuota"""
    try:
        supabase.table("vault_cartelle").insert({"nome": nome_cartella, "creato_da": user_id}).execute()
        return True
    except Exception as e:
        print(f"Errore creazione cartella: {e}")
        return False

def move_vault_file(file_id, nuova_cartella):
    """Sposta un file in un'altra cartella (aggiornando l'etichetta)"""
    try:
        supabase.table("vault_documenti").update({"cartella": nuova_cartella}).eq("id", file_id).execute()
        return True
    except Exception as e:
        print(f"Errore spostamento file: {e}")
        return False

def delete_vault_folder(nome_cartella):
    """Elimina la cartella (se non è 'Generale') e sposta i suoi file in 'Generale'"""
    if nome_cartella == 'Generale': return False
    try:
        # Sposta i file orfani in Generale
        supabase.table("vault_documenti").update({"cartella": 'Generale'}).eq("cartella", nome_cartella).execute()
        # Elimina la cartella
        supabase.table("vault_cartelle").delete().eq("nome", nome_cartella).execute()
        return True
    except Exception as e:
        print(f"Errore cancellazione cartella: {e}")
        return False


# 3. Blocco di test: viene eseguito solo se lanciamo questo file direttamente
if __name__ == "__main__":
    print("Tentativo di connessione a Supabase in corso...")
    dati = get_inventory()
    print("Connessione riuscita! Ecco cosa c'è nel database:")
    print(dati)
