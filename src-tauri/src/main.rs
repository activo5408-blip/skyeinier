// Evita que se abra una consola extra en Windows en modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::collections::HashSet;

/// Un video de YouTube tal como lo mostramos en la interfaz.
#[derive(Serialize, Clone, Debug)]
struct VideoInfo {
    id: String,
    title: String,
    channel: String,
    duration: String,
    thumbnail: String,
}

/// Busca en YouTube (como si lo hicieras a mano en youtube.com/results) y devuelve
/// la lista completa de resultados reales con título, canal, duración y miniatura.
/// No usa la YouTube Data API (no hace falta API key) y siempre trae contenido
/// actual porque es una búsqueda en vivo contra YouTube.
#[tauri::command]
async fn buscar_youtube(consulta: String) -> Result<Vec<VideoInfo>, String> {
    let url = format!(
        "https://www.youtube.com/results?search_query={}&hl=es",
        urlencoding::encode(&consulta)
    );
    obtener_videos_de(&url).await
}

async fn obtener_videos_de(url: &str) -> Result<Vec<VideoInfo>, String> {
    let cliente = reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| format!("No se pudo crear el cliente HTTP: {e}"))?;

    let respuesta = cliente
        .get(url)
        .header("Accept-Language", "es-419,es;q=0.9,en;q=0.8")
        // Evita la pantalla de "consentimiento de cookies" de la UE, que devolvería
        // HTML sin resultados en vez de la página de búsqueda.
        .header("Cookie", "CONSENT=YES+1")
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con YouTube: {e}"))?;

    let html = respuesta
        .text()
        .await
        .map_err(|e| format!("No se pudo leer la respuesta de YouTube: {e}"))?;

    let json_texto = extraer_json_balanceado(&html, "var ytInitialData")
        .or_else(|| extraer_json_balanceado(&html, "ytInitialData"))
        .ok_or_else(|| {
            "YouTube no devolvió resultados (puede haber cambiado su formato).".to_string()
        })?;

    let valor: serde_json::Value = serde_json::from_str(&json_texto)
        .map_err(|e| format!("Error interpretando los datos de YouTube: {e}"))?;

    let mut videos = Vec::new();
    let mut vistos = HashSet::new();
    recolectar_videos(&valor, &mut videos, &mut vistos);

    if videos.is_empty() {
        return Err("YouTube no devolvió resultados para esta búsqueda.".to_string());
    }

    Ok(videos)
}

/// Busca el primer `{` después de `marcador` y devuelve el bloque JSON completo,
/// contando llaves para no cortarlo a mitad (evita el bug de las listas incompletas).
fn extraer_json_balanceado(html: &str, marcador: &str) -> Option<String> {
    let inicio_marcador = html.find(marcador)?;
    let resto = &html[inicio_marcador + marcador.len()..];
    let inicio_llave = resto.find('{')?;
    let bytes = resto.as_bytes();

    let mut profundidad: i32 = 0;
    let mut en_cadena = false;
    let mut escapando = false;
    let mut fin = None;

    for (i, &b) in bytes.iter().enumerate().skip(inicio_llave) {
        let c = b as char;
        if en_cadena {
            if escapando {
                escapando = false;
            } else if c == '\\' {
                escapando = true;
            } else if c == '"' {
                en_cadena = false;
            }
            continue;
        }
        match c {
            '"' => en_cadena = true,
            '{' => profundidad += 1,
            '}' => {
                profundidad -= 1;
                if profundidad == 0 {
                    fin = Some(i + 1);
                    break;
                }
            }
            _ => {}
        }
    }

    let fin = fin?;
    Some(resto[inicio_llave..fin].to_string())
}

/// Recorre el JSON entero de YouTube buscando cualquier "videoRenderer" o
/// "playlistVideoRenderer", sin importar en qué parte del árbol esté. Esto es
/// más resistente a cambios de YouTube que seguir una ruta fija.
fn recolectar_videos(valor: &serde_json::Value, salida: &mut Vec<VideoInfo>, vistos: &mut HashSet<String>) {
    match valor {
        serde_json::Value::Object(mapa) => {
            for clave in ["videoRenderer", "playlistVideoRenderer"] {
                if let Some(v) = mapa.get(clave) {
                    if let Some(info) = interpretar_video(v) {
                        if vistos.insert(info.id.clone()) {
                            salida.push(info);
                        }
                    }
                }
            }
            for v in mapa.values() {
                recolectar_videos(v, salida, vistos);
            }
        }
        serde_json::Value::Array(lista) => {
            for v in lista {
                recolectar_videos(v, salida, vistos);
            }
        }
        _ => {}
    }
}

fn texto_de(valor: &serde_json::Value) -> Option<String> {
    if let Some(s) = valor.get("simpleText").and_then(|v| v.as_str()) {
        return Some(s.to_string());
    }
    if let Some(runs) = valor.get("runs").and_then(|v| v.as_array()) {
        let texto: String = runs
            .iter()
            .filter_map(|r| r.get("text").and_then(|t| t.as_str()))
            .collect();
        if !texto.is_empty() {
            return Some(texto);
        }
    }
    None
}

fn interpretar_video(v: &serde_json::Value) -> Option<VideoInfo> {
    let id = v.get("videoId")?.as_str()?.to_string();
    if id.is_empty() {
        return None;
    }

    let title = v
        .get("title")
        .and_then(texto_de)
        .unwrap_or_else(|| "Sin título".to_string());

    let channel = v
        .get("longBylineText")
        .and_then(texto_de)
        .or_else(|| v.get("shortBylineText").and_then(texto_de))
        .unwrap_or_default();

    let duration = v
        .get("lengthText")
        .and_then(texto_de)
        .or_else(|| {
            v.get("thumbnailOverlayTimeStatusRenderer")
                .and_then(|t| t.get("text"))
                .and_then(texto_de)
        })
        .unwrap_or_default();

    let thumbnail = format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg");

    Some(VideoInfo {
        id,
        title,
        channel,
        duration,
        thumbnail,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![buscar_youtube])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación Tauri");
}
