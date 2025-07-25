#!/bin/bash

# ===================================================================================
# Bash Wrapper
# -----------------------------------------------------------------------------------
# Dieses Skript führt ein eingebettetes Python-Skript aus, um ungenutzte
# Übersetzungs-Keys in den .json-Dateien des Add-ons zu finden und zu entfernen.
# ===================================================================================

# Führe das eingebettete Python-Skript aus.
python3 <<'EOF'

import json
import os
import re
import sys
from pathlib import Path
from collections import OrderedDict

# ===================================================================================
# Konfiguration
# ===================================================================================
# Das Skript geht davon aus, dass es vom Hauptverzeichnis des Projekts ausgeführt wird.
# (im selben Ordner, in dem auch 'sync-lang-keys.py' liegt)
SRC_DIR = Path('src')
LOCALES_DIR = SRC_DIR / '_locales'
# Dateitypen, die nach Key-Nutzung durchsucht werden.
FILE_EXTENSIONS_TO_SCAN = ['.js', '.html']
# Zusätzliche spezifische Dateien, die durchsucht werden sollen.
ADDITIONAL_FILES_TO_SCAN = [SRC_DIR / 'manifest.json']


def get_all_existing_keys(locales_dir: Path) -> set:
    """
    Sammelt alle existierenden Übersetzungs-Keys aus allen .json-Dateien.
    """
    if not locales_dir.is_dir():
        print(f"Fehler: Das Verzeichnis '{locales_dir}' wurde nicht gefunden.")
        return set()

    print(f"1. Sammle alle existierenden Keys aus '{locales_dir}'...")
    existing_keys = set()
    json_files = list(locales_dir.rglob('*.json'))

    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                existing_keys.update(data.keys())
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warnung: Konnte Datei '{file_path}' nicht lesen oder parsen: {e}")
            
    print(f"   -> {len(existing_keys)} einzigartige Keys gefunden.")
    return existing_keys


def find_all_used_keys(src_dir: Path, existing_keys: set) -> set:
    """
    Findet alle genutzten Keys, indem nach dem exakten Key-String im Code gesucht wird.

    :param src_dir: Der Pfad zum `src`-Verzeichnis.
    :param existing_keys: Ein Set aller Keys, nach denen gesucht werden soll.
    :return: Ein Set mit allen genutzten Schlüsseln.
    """
    print(f"2. Suche nach der Verwendung dieser Keys im Verzeichnis '{src_dir}'...")
    used_keys = set()
    
    # Sammle alle relevanten Dateien für die Suche
    files_to_scan = list(ADDITIONAL_FILES_TO_SCAN)
    for ext in FILE_EXTENSIONS_TO_SCAN:
        files_to_scan.extend(src_dir.rglob(f'*{ext}'))

    # Lade den Inhalt aller zu durchsuchenden Dateien in einen einzigen String,
    # um die Suche zu beschleunigen.
    total_content = ""
    for file_path in files_to_scan:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                total_content += f.read()
        except IOError:
            # Ignoriere Lese-Fehler stillschweigend
            pass
            
    # Prüfe für jeden existierenden Key, ob er im Gesamtinhalt vorkommt
    for key in existing_keys:
        if key in total_content:
            used_keys.add(key)

    print(f"   -> {len(used_keys)} Keys wurden im Code wiedergefunden.")
    return used_keys


def remove_keys_from_files(locales_dir: Path, keys_to_remove: set):
    """
    Entfernt die angegebenen Schlüssel aus allen .json-Dateien im locales-Ordner.
    """
    print(f"\n4. Entferne ungenutzte Keys aus allen .json-Dateien...")
    json_files = list(locales_dir.rglob('*.json'))
    total_removed_count = 0

    for file_path in json_files:
        try:
            with open(file_path, 'r+', encoding='utf-8') as f:
                data = json.load(f, object_pairs_hook=OrderedDict)
                original_key_count = len(data)
                
                cleaned_data = OrderedDict([(k, v) for k, v in data.items() if k not in keys_to_remove])
                
                removed_count = original_key_count - len(cleaned_data)
                if removed_count > 0:
                    print(f"   - '{file_path.relative_to(SRC_DIR.parent)}': {removed_count} Key(s) entfernt.")
                    total_removed_count += removed_count
                    
                    f.seek(0)
                    json.dump(cleaned_data, f, indent=4, ensure_ascii=False)
                    f.write('\n')
                    f.truncate()
        except (IOError, json.JSONDecodeError) as e:
            print(f"Fehler beim Bearbeiten der Datei '{file_path}': {e}")
            
    print(f"\nBereinigung abgeschlossen. Insgesamt wurden {total_removed_count} Key-Einträge entfernt.")


def main():
    """
    Hauptfunktion zur Orchestrierung des gesamten Prozesses.
    """
    all_keys = get_all_existing_keys(LOCALES_DIR)
    if not all_keys:
        return

    used_keys = find_all_used_keys(SRC_DIR, all_keys)
    unused_keys = sorted(list(all_keys - used_keys))

    print("-" * 50)

    if not unused_keys:
        print("Ergebnis: Perfekt! Keine ungenutzten Übersetzungs-Keys gefunden. ✅")
        return

    print(f"3. Ergebnis: {len(unused_keys)} ungenutzte Key(s) gefunden:")
    for key in unused_keys:
        print(f"  - {key}")
    print("-" * 50)

    # Korrigierte Benutzereingabe, die den stdin-Redirect umgeht
    print("Sollen diese ungenutzten Schlüssel jetzt aus allen Sprachdateien entfernt werden? (j/n): ", end='', flush=True)
    decision = ''
    try:
        if sys.platform == 'win32':
             # Windows hat kein /dev/tty, nutze stattdessen die normale Eingabe, die hier fehlschlagen könnte.
             print("\nWarnung: Direkte Eingabe unter Windows kann fehlschlagen. Breche vorsichtshalber ab.")
        else:
            with open('/dev/tty') as tty:
                decision = tty.readline().strip().lower()
    except (IOError, KeyboardInterrupt):
        # Wenn /dev/tty nicht lesbar ist oder der User abbricht
        print("\nEingabe fehlgeschlagen oder durch Benutzer abgebrochen.")
        decision = 'n'


    if decision == 'j':
        remove_keys_from_files(LOCALES_DIR, set(unused_keys))
    else:
        print("\nAbbruch durch Benutzer. Es wurden keine Änderungen vorgenommen.")


if __name__ == "__main__":
    main()

EOF
# ===================================================================================
# Ende des Bash Wrappers
# ===================================================================================

read -p "
Drücke ENTER zum Beenden..."
