import shutil
import pathlib
import os

def sync():
    root_dir = pathlib.Path(__file__).parent.parent
    src_dir = root_dir / "out"
    dest_dir = root_dir / "web" / "data"

    print(f"🔄 Synchronisation des données...")
    print(f"Source: {src_dir}")
    print(f"Destination: {dest_dir}")

    if not src_dir.exists():
        print(f"❌ Erreur : Le dossier source '{src_dir}' n'existe pas. Lancez d'abord les scripts de stats.")
        return

    # Create destination if missing
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Sync content
    # In Python, we can't easily 'overwrite' a whole directory tree with copytree 
    # if it exists (before 3.8 dirs_exist_ok). 
    # To be safe and clean, we iterate and copy.
    
    # Sync content using dirs_exist_ok=True (Python 3.8+)
    # This is much more robust on Windows/OneDrive as it doesn't try to delete folders first.
    try:
        shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
        print(f"✅ Terminé ! Le contenu de 'out/' a été synchronisé avec 'web/data/'.")
    except Exception as e:
        print(f"❌ Erreur lors de la synchronisation : {e}")
        print(f"ℹ️ Conseil : Vérifiez qu'aucun fichier n'est ouvert ou que OneDrive n'est pas en train de synchroniser.")
    print(f"👉 Vous pouvez maintenant rafraîchir le site web.")

if __name__ == "__main__":
    sync()
