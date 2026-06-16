import os
import json
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

CACHE_FILE = 'feed_cache.json'
CACHE_DURATION = 300  # Cache duration in seconds (5 minutes)
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def parse_html_updates(html_content, date_str, base_link):
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    # Google release notes structure typically uses <h3> for headers (e.g. Feature, Changed, etc.)
    # and subsequent siblings (<p>, <ul>, etc.) for details.
    h3_elements = soup.find_all('h3')
    
    if not h3_elements:
        # Fallback: treat the entire content as a single general update if no h3 is present
        for link in soup.find_all('a'):
            link['target'] = '_blank'
            link['rel'] = 'noopener noreferrer'
        text_content = soup.get_text(separator=" ").strip()
        updates.append({
            "id": f"{date_str.lower().replace(' ', '_').replace(',', '')}_0",
            "type": "General",
            "html": str(soup),
            "text": text_content,
            "base_link": base_link
        })
        return updates
        
    for index, h3 in enumerate(h3_elements):
        update_type = h3.get_text().strip()
        
        sibling_htmls = []
        sibling_texts = []
        next_node = h3.next_sibling
        
        while next_node and next_node.name != 'h3':
            if next_node.name:
                # Add target="_blank" to links so they don't open in-app
                for link in next_node.find_all('a'):
                    link['target'] = '_blank'
                    link['rel'] = 'noopener noreferrer'
                
                sibling_htmls.append(str(next_node))
                sibling_texts.append(next_node.get_text().strip())
            next_node = next_node.next_sibling
            
        update_html = "".join(sibling_htmls)
        update_text = " ".join(sibling_texts)
        
        update_id = f"{date_str.lower().replace(' ', '_').replace(',', '')}_{update_type.lower()}_{index}"
        
        updates.append({
            "id": update_id,
            "type": update_type,
            "html": update_html,
            "text": update_text,
            "base_link": base_link
        })
        
    return updates

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_data = response.content
    except Exception as e:
        return {"error": f"Failed to fetch feed: {str(e)}", "timestamp": time.time(), "releases": []}

    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        return {"error": f"Failed to parse XML: {str(e)}", "timestamp": time.time(), "releases": []}

    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    releases = []

    for entry_elem in root.findall('atom:entry', ns):
        title_elem = entry_elem.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        updated_elem = entry_elem.find('atom:updated', ns)
        updated_str = updated_elem.text if updated_elem is not None else ""
        
        link_elem = entry_elem.find('atom:link', ns)
        link_url = ""
        if link_elem is not None:
            link_url = link_elem.attrib.get('href', '')
            
        content_elem = entry_elem.find('atom:content', ns)
        html_content = content_elem.text if content_elem is not None else ""
        
        updates = parse_html_updates(html_content, date_str, link_url)
        
        releases.append({
            "date": date_str,
            "updated": updated_str,
            "link": link_url,
            "updates": updates
        })

    data = {
        "releases": releases,
        "timestamp": time.time(),
        "error": None
    }

    # Save to cache file
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error writing cache: {e}")

    return data

def get_release_notes(force_refresh=False):
    # Check if cache exists and is fresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Check cache age
            if time.time() - data.get('timestamp', 0) < CACHE_DURATION:
                return data
        except Exception as e:
            print(f"Error reading cache: {e}")
            
    # Cache miss or forced refresh
    return fetch_and_parse_feed()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data = get_release_notes(force_refresh=force_refresh)
    return jsonify(data)

if __name__ == '__main__':
    # Run server on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
