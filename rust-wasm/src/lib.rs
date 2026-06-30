
use wasm_bindgen::prelude::*;
use flate2::Compression;
use flate2::write::{GzEncoder, GzDecoder};
use std::io::prelude::*;
// use regex::Regex;
use serde_json;



#[wasm_bindgen]
pub fn export_to_markdown(raw: &str) -> String {
    raw.to_string()
}

// Compress the document
#[wasm_bindgen]
pub fn compress_document(data: &str) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data.as_bytes()).unwrap();
    encoder.finish().unwrap()
}

// Decompress the document
#[wasm_bindgen]
pub fn decompress_document(compressed_data: &[u8]) -> String {
    let mut decoder = GzDecoder::new(Vec::new());
    decoder.write_all(compressed_data).unwrap();
    let decompressed = decoder.finish().unwrap();
    String::from_utf8(decompressed).unwrap_or_else(|_| String::new())
}


// Format the text for better readability and consistency
#[wasm_bindgen]
pub fn format_text(input: &str) -> String {
    let mut text = input.to_string();
    
    // 1. Clean up extra whitespace and line breaks
    text = clean_whitespace(&text);
    
    // 2. Fix markdown headers
    text = fix_markdown_headers(&text);
    
    // 3. Format code blocks
    text = format_code_blocks(&text);
    
    // 4. Fix bold, italic, underline formatting
    text = fix_markdown_formatting(&text);

    // 5. Fix punctuation.  This  fixes common punctuation spacing issues and cleans up double
    //    punctuation.  //    It also ensures that punctuation is properly spaced from words.
    text = fix_punctuation(&text);
    
    text
}

use regex::Regex;
fn clean_whitespace(text: &str) -> String {
    let re_multiple_spaces = Regex::new(r" {2,}").unwrap();
    let re_multiple_newlines = Regex::new(r"\n{3,}").unwrap();
    let re_trailing_spaces = Regex::new(r" +$").unwrap();
    
    let mut result = re_multiple_spaces.replace_all(text, " ").to_string();
    result = re_multiple_newlines.replace_all(&result, "\n\n").to_string();
    result = re_trailing_spaces.replace_all(&result, "").to_string();
    
    result.trim().to_string()
}

fn is_url(text: &str) -> bool {
    text.starts_with("http://") || 
    text.starts_with("https://") || 
    text.starts_with("ftp://") ||
    text.starts_with("www.")
}


fn fix_markdown_headers(text: &str) -> String {
    let re_headers = Regex::new(r"^(#{1,6}) *(.+)$").unwrap();
    
    text.lines()
        .map(|line| {
            re_headers.replace(line, |caps: &regex::Captures| {
                format!("{} {}", &caps[1], &caps[2].trim())
            }).to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_code_blocks(text: &str) -> String {
    let re_code_blocks = Regex::new(r"```([a-zA-Z]*)\n([\s\S]*?)\n```").unwrap();
    
    re_code_blocks.replace_all(text, |caps: &regex::Captures| {
        let lang = &caps[1];
        let code = caps[2].trim();
        format!("```{}\n{}\n```", lang, code)
    }).to_string()
}

fn fix_markdown_formatting(text: &str) -> String {
    let mut result = text.to_string();
    
    // Fix bold formatting
    let re_bold = Regex::new(r"\*\* *([^*]+?) *\*\*").unwrap();
    result = re_bold.replace_all(&result, "**$1**").to_string();
    
    // Fix italic formatting  
    let re_italic = Regex::new(r"\* *([^*]+?) *\*").unwrap();
    result = re_italic.replace_all(&result, "*$1*").to_string();
    
    result
}

// Toggle bold formatting on selected text
#[wasm_bindgen]
pub fn toggle_bold(text: &str) -> String {
    let trimmed = text.trim();
    
    // Check if text is already bold (wrapped in **)
    if trimmed.starts_with("**") && trimmed.ends_with("**") && trimmed.len() > 4 {
        // Remove bold formatting
        trimmed[2..trimmed.len()-2].to_string()
    } else {
        // Add bold formatting
        format!("**{}**", trimmed)
    }
}

// Toggle italic formatting on selected text
#[wasm_bindgen]
pub fn toggle_italic(text: &str) -> String {
    let trimmed = text.trim();
    
    // Check if text is already italic (wrapped in single *)
    // Make sure it's not bold (**) by checking it doesn't start with **
    if trimmed.starts_with("*") && trimmed.ends_with("*") && trimmed.len() > 2 
        && !trimmed.starts_with("**") {
        // Remove italic formatting
        trimmed[1..trimmed.len()-1].to_string()
    } else {
        // Add italic formatting
        format!("*{}*", trimmed)
    }
}

// Toggle underline formatting on selected text
// Uses HTML <u> tags since Markdown has no native underline syntax
#[wasm_bindgen]
pub fn toggle_underline(text: &str) -> String {
    let trimmed = text.trim();

    // Check if text is already underlined (wrapped in <u></u>)
    if trimmed.starts_with("<u>") && trimmed.ends_with("</u>") && trimmed.len() > 7 {
        // Remove underline formatting
        trimmed[3..trimmed.len()-4].to_string()
    } else {
        // Add underline formatting
        format!("<u>{}</u>", trimmed)
    }
}

/// Toggle strikethrough formatting using `~~text~~`
#[wasm_bindgen]
pub fn toggle_strikethrough(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.starts_with("~~") && trimmed.ends_with("~~") && trimmed.len() > 4 {
        trimmed[2..trimmed.len()-2].to_string()
    } else {
        format!("~~{}~~", trimmed)
    }
}



/// Toggle markdown heading level (e.g. "# Heading" -> "## Heading")
#[wasm_bindgen]
pub fn toggle_heading(text: &str, level: u8) -> String {
    let trimmed = text.trim();

    // Compile regex safely
    let re = Regex::new(r"^(#{1,6})\s+(.*)$");
    if re.is_err() {
        return format!("<!-- regex compile failed -->\n{}", text);
    }
    let re = re.unwrap();

    if let Some(caps) = re.captures(trimmed) {
        let content = caps.get(2).map_or("", |m| m.as_str()).trim();
        format!("{} {}", "#".repeat(level as usize), content)
    } else {
        // fallback: no match, just prepend heading
        format!("{} {}", "#".repeat(level as usize), trimmed)
    }
}

/// Check if a line starts with a bullet marker (-, *, or +)
fn is_bullet_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ")
}

/// Remove bullet marker from a line
fn remove_bullet(line: &str) -> String {
    let trimmed = line.trim_start();
    if trimmed.starts_with("- ") {
        trimmed[2..].to_string()
    } else if trimmed.starts_with("* ") {
        trimmed[2..].to_string()
    } else if trimmed.starts_with("+ ") {
        trimmed[2..].to_string()
    } else {
        line.to_string()
    }
}

/// Toggle markdown bullet list (add/remove `- `, `* `, or `+ ` at the start of each line)
#[wasm_bindgen]
pub fn toggle_list(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let is_list = lines.iter().all(|line| is_bullet_line(line));

    if is_list {
        // Remove bullet marker from each line
        lines.iter()
            .map(|line| remove_bullet(line))
            .collect::<Vec<String>>()
            .join("\n")
    } else {
        // Add `- ` to each line
        lines.iter()
            .map(|line| format!("- {}", line.trim()))
            .collect::<Vec<String>>()
            .join("\n")
    }
}

/// Check if a line starts with a number marker (1., 2., etc.)
fn is_numbered_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    // Match digits followed by . and space
    let mut chars = trimmed.chars().peekable();
    let mut has_digit = false;
    while let Some(c) = chars.next() {
        if c.is_ascii_digit() {
            has_digit = true;
        } else if c == '.' && has_digit {
            return chars.next() == Some(' ');
        } else {
            return false;
        }
    }
    false
}

/// Remove number marker from a line
fn remove_number(line: &str) -> String {
    let trimmed = line.trim_start();
    if let Some(pos) = trimmed.find(". ") {
        let prefix = &trimmed[..pos];
        if prefix.chars().all(|c| c.is_ascii_digit()) {
            return trimmed[pos + 2..].to_string();
        }
    }
    line.to_string()
}

/// Toggle markdown numbered list (add/remove `1. `, `2. `, etc. at the start of each line)
#[wasm_bindgen]
pub fn toggle_numbered_list(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let is_list = lines.iter().all(|line| is_numbered_line(line));

    if is_list {
        // Remove number marker from each line
        lines.iter()
            .map(|line| remove_number(line))
            .collect::<Vec<String>>()
            .join("\n")
    } else {
        // Add numbered markers to each line
        lines.iter()
            .enumerate()
            .map(|(i, line)| format!("{}. {}", i + 1, line.trim()))
            .collect::<Vec<String>>()
            .join("\n")
    }
}










#[wasm_bindgen]
pub fn calculate_document_stats(text: &str) -> String {
    let words = count_words(text);
    let chars_with_spaces = text.len();
    let chars_without_spaces = text.chars().filter(|c| !c.is_whitespace()).count();
    let lines = count_lines(text);
    let reading_time = estimate_reading_time(words);
    
    // Return as JSON string for easy parsing in JS
    format!(
        "{{\"words\":{},\"chars_with_spaces\":{},\"chars_without_spaces\":{},\"lines\":{},\"reading_time\":{}}}",
        words, chars_with_spaces, chars_without_spaces, lines, reading_time
    )
}

fn count_words(text: &str) -> usize {
    text.split_whitespace().count()
}

fn count_lines(text: &str) -> usize {
    if text.is_empty() {
        0
    } else {
        text.lines().count()
    }
}

fn estimate_reading_time(words: usize) -> usize {
    // Average reading speed: 200 words per minute
    let minutes = (words as f64 / 200.0).ceil() as usize;
    if minutes == 0 { 1 } else { minutes }
}



fn fix_punctuation(text: &str) -> String {
    let mut result = text.to_string();
    
    // Fix common punctuation spacing issues
    result = result.replace(" ,", ",");
    result = result.replace(" .", ".");
    result = result.replace("( ", "(").replace(" )", ")");
    result = result.replace(" :", ":");
    result = result.replace(" ;", ";");
    result = result.replace(" !", "!");
    result = result.replace(" ?", "?");
    
    // Fix multiple punctuation
    result = result.replace("..", ".").replace(",,", ",");
    
    result
}

#[wasm_bindgen]
pub fn convert_url_to_markdown(text: &str) -> String {
    let trimmed = text.trim(); // This removes leading/trailing whitespace
    
    // Check if it's already a markdown link
    if trimmed.starts_with("[") && trimmed.contains("](") && trimmed.ends_with(")") {
        return text.to_string(); // Return original text to preserve spacing
    }
    
    // Check if it looks like a URL
    if is_url(trimmed) {
        // Replace just the URL part, preserve any surrounding whitespace
        let before_trim = &text[..text.len() - text.trim_start().len()];
        let after_trim = &text[trimmed.len() + before_trim.len()..];
        format!("{}[{}]({}){}", before_trim, trimmed, trimmed, after_trim)
    } else {
        text.to_string()
    }
}




// PromiseGrid integration placeholder
// ADD THESE IMPORTS to the top of your existing lib.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ADD THESE STRUCTS after your existing imports but before your functions

/// PromiseGrid message structure following the spec
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PromiseGridMessage {
    pub protocol_hash: String,  // CID identifying the protocol spec
    pub payload: MessagePayload,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessagePayload {
    pub message_type: String,
    pub data: HashMap<String, serde_cbor::Value>,
}

/// Document edit message for collab-editor integration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DocumentEdit {
    pub document_id: String,
    pub edit_type: String,  // "insert", "delete", "replace", "format"
    pub position: u32,
    pub content: String,
    pub timestamp: f64,
    pub user_id: String,
}

// ADD THESE FUNCTIONS to your existing lib.rs (alongside your other #[wasm_bindgen] functions)

/// Create a PromiseGrid CBOR message for a document edit
#[wasm_bindgen]
pub fn create_promisegrid_edit_message(
    document_id: &str,
    edit_type: &str,
    position: u32,
    content: &str,
    user_id: &str
) -> Vec<u8> {
    let timestamp = js_sys::Date::now();
    
    // Create edit data map
    let mut data = HashMap::new();
    data.insert("document_id".to_string(), serde_cbor::Value::Text(document_id.to_string()));
    data.insert("edit_type".to_string(), serde_cbor::Value::Text(edit_type.to_string()));
    data.insert("position".to_string(), serde_cbor::Value::Integer(position as i128));
    data.insert("content".to_string(), serde_cbor::Value::Text(content.to_string()));
    data.insert("timestamp".to_string(), serde_cbor::Value::Float(timestamp));
    data.insert("user_id".to_string(), serde_cbor::Value::Text(user_id.to_string()));

    let payload = MessagePayload {
        message_type: "document_edit".to_string(),
        data,
    };

    let message = PromiseGridMessage {
        // Placeholder protocol hash - in real implementation this would be actual CID
        protocol_hash: "QmPromiseGridProtocolV1".to_string(),
        payload,
    };

    // Create CBOR with PromiseGrid tag (0x67726964 = 'grid')
    encode_with_grid_tag(&message).unwrap_or_else(|_| Vec::new())
}

/// Create a PromiseGrid message for document statistics
#[wasm_bindgen]
pub fn create_promisegrid_stats_message(
    document_id: &str,
    word_count: u32,
    char_count: u32,
    line_count: u32,
    user_id: &str
) -> Vec<u8> {
    let timestamp = js_sys::Date::now();
    
    let mut data = HashMap::new();
    data.insert("document_id".to_string(), serde_cbor::Value::Text(document_id.to_string()));
    data.insert("word_count".to_string(), serde_cbor::Value::Integer(word_count as i128));
    data.insert("char_count".to_string(), serde_cbor::Value::Integer(char_count as i128));
    data.insert("line_count".to_string(), serde_cbor::Value::Integer(line_count as i128));
    data.insert("timestamp".to_string(), serde_cbor::Value::Float(timestamp));
    data.insert("user_id".to_string(), serde_cbor::Value::Text(user_id.to_string()));

    let payload = MessagePayload {
        message_type: "document_stats".to_string(),
        data,
    };

    let message = PromiseGridMessage {
        protocol_hash: "QmPromiseGridProtocolV1".to_string(),
        payload,
    };

    encode_with_grid_tag(&message).unwrap_or_else(|_| Vec::new())
}

/// Parse a PromiseGrid CBOR message and return JSON string
#[wasm_bindgen]
pub fn parse_promisegrid_message(cbor_bytes: &[u8]) -> String {
    // Add detailed error reporting
    web_sys::console::log_1(&format!("Parsing {} bytes", cbor_bytes.len()).into());
    
    match decode_with_grid_tag(cbor_bytes) {
        Ok(message) => {
            match serde_json::to_string_pretty(&message) {
                Ok(json) => json,
                Err(e) => format!("JSON serialization error: {}", e)
            }
        }
        Err(e) => format!("CBOR parsing error: {}", e)
    }
}




/// Log PromiseGrid message to browser console (for debugging)
#[wasm_bindgen]
pub fn log_promisegrid_message(cbor_bytes: &[u8]) {
    let json = parse_promisegrid_message(cbor_bytes);
    web_sys::console::log_1(&format!("PromiseGrid Message: {}", json).into());
}

/// Export current document content as PromiseGrid CBOR message
#[wasm_bindgen]
pub fn export_document_as_promisegrid(
    document_content: &str,
    document_id: &str,
    user_id: &str
) -> Vec<u8> {
    create_promisegrid_edit_message(
        document_id,
        "export",
        0,
        document_content,
        user_id
    )
}

#[wasm_bindgen]
pub fn search_document(content: &str, query: &str, case_sensitive: bool) -> String {
    if query.is_empty() {
        return "[]".to_string();
    }
    
    let search_content = if case_sensitive { content.to_string() } else { content.to_lowercase() };
    let search_query = if case_sensitive { query.to_string() } else { query.to_lowercase() };
    
    let mut matches = Vec::new();
    let mut start = 0;
    
    while let Some(pos) = search_content[start..].find(&search_query) {
        let absolute_pos = start + pos;
        matches.push(format!("{{\"start\":{},\"end\":{},\"text\":\"{}\"}}", 
            absolute_pos, 
            absolute_pos + query.len(), 
            &content[absolute_pos..absolute_pos + query.len()]));
        start = absolute_pos + 1;
    }
    
    format!("[{}]", matches.join(","))
}



// ADD THESE HELPER FUNCTIONS (internal, not exported to WASM)
/// Encode PromiseGrid message with the official 'grid' CBOR tag
/// (0x67726964)
fn encode_with_grid_tag(message: &PromiseGridMessage) -> Result<Vec<u8>, serde_cbor::Error> {
    // First encode the message normally
    let untagged_bytes = serde_cbor::to_vec(message)?;
    
    // Manually add CBOR tag bytes at the beginning
    // CBOR tag format: major type 6 (0xC0 + tag encoding)
    let grid_tag = 0x67726964u64; // 'grid' in hex
    
    let mut tagged_bytes = Vec::new();
    
    // Add CBOR tag header for large positive integer
    // Tag 0x67726964 requires 5 bytes: 0xDA + 4 bytes for the tag value
    tagged_bytes.push(0xDA); // Major type 6, additional info 26 (4-byte tag)
    tagged_bytes.extend_from_slice(&grid_tag.to_be_bytes()[4..8]); // Last 4 bytes of tag
    
    // Add the original message bytes
    tagged_bytes.extend_from_slice(&untagged_bytes);
    
    web_sys::console::log_1(&format!("Added CBOR tag manually").into());
    
    Ok(tagged_bytes)
}
/// Decode PromiseGrid message with tag validation
fn decode_with_grid_tag(cbor_bytes: &[u8]) -> Result<PromiseGridMessage, Box<dyn std::error::Error>> {
    // Check if it starts with our manual tag
    if cbor_bytes.len() >= 5 && cbor_bytes[0] == 0xDA {
        let tag_bytes = &cbor_bytes[1..5];
        if tag_bytes == [103, 114, 105, 100] { // "grid"
            web_sys::console::log_1(&"Found manual PromiseGrid tag!".into());
            // Parse the rest as the message
            let message: PromiseGridMessage = serde_cbor::from_slice(&cbor_bytes[5..])?;
            return Ok(message);
        }
    }
    
    // Fallback to old parsing
    let tagged_value: serde_cbor::Value = serde_cbor::from_slice(cbor_bytes)?;
    
    match tagged_value {
        serde_cbor::Value::Tag(tag, boxed_value) => {
            web_sys::console::log_1(&format!("Found tag: {}", tag).into());
            if tag == 0x67726964 {
                let message_cbor = serde_cbor::to_vec(&*boxed_value)?;
                let message: PromiseGridMessage = serde_cbor::from_slice(&message_cbor)?;
                Ok(message)
            } else {
                Err(format!("Invalid tag: expected 0x67726964, got 0x{:x}", tag).into())
            }
        }
        serde_cbor::Value::Map(_) => {
            web_sys::console::log_1(&"Parsing untagged message".into());
            let message: PromiseGridMessage = serde_cbor::from_slice(cbor_bytes)?;
            Ok(message)
        }
        _ => {
            Err("Message is not tagged with PromiseGrid tag".into())
        }
    }
}


