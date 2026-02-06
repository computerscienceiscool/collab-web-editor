// Cargo.toml dependencies you'll need:
// [dependencies]
// wasm-bindgen = "0.2"
// serde = { version = "1.0", features = ["derive"] }
// serde_cbor = "0.11"
// web-sys = "0.3"
// js-sys = "0.3"

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// PromiseGrid message structure
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

// Document edit message for collab-editor
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DocumentEdit {
    pub document_id: String,
    pub edit_type: String,  // "insert", "delete", "replace"
    pub position: u32,
    pub content: String,
    pub timestamp: f64, // each agent runs their own clock.  we can not garentee sync.  
    pub user_id: String,
}

#[wasm_bindgen]
pub struct PromiseGridHandler {
    protocol_hash: String,
}

#[wasm_bindgen]
impl PromiseGridHandler {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PromiseGridHandler {
        console_error_panic_hook::set_once();
        
        PromiseGridHandler {
            // For now, use a placeholder protocol hash
            // In real implementation, this would be the actual CID of the protocol spec
            protocol_hash: "QmX1eVtVcs7YHr8L8cj9F4K2Hn7VqY9Z3B4A5C6D7E8F9".to_string(),
        }
    }

    /// Create a PromiseGrid message for a document edit
    #[wasm_bindgen]
    pub fn create_edit_message(&self, 
        document_id: &str, 
        edit_type: &str,
        position: u32,
        content: &str,
        user_id: &str
    ) -> Result<Vec<u8>, JsValue> {
        
        let timestamp = js_sys::Date::now();
        
        let edit = DocumentEdit {
            document_id: document_id.to_string(),
            edit_type: edit_type.to_string(),
            position,
            content: content.to_string(),
            timestamp,
            user_id: user_id.to_string(),
        };

        // Convert edit to generic data map
        let mut data = HashMap::new();
        data.insert("document_id".to_string(), serde_cbor::Value::Text(edit.document_id));
        data.insert("edit_type".to_string(), serde_cbor::Value::Text(edit.edit_type));
        data.insert("position".to_string(), serde_cbor::Value::Integer(position as i128));
        data.insert("content".to_string(), serde_cbor::Value::Text(edit.content));
        data.insert("timestamp".to_string(), serde_cbor::Value::Float(timestamp));
        data.insert("user_id".to_string(), serde_cbor::Value::Text(edit.user_id));

        let payload = MessagePayload {
            message_type: "document_edit".to_string(),
            data,
        };

        let message = PromiseGridMessage {
            protocol_hash: self.protocol_hash.clone(),
            payload,
        };

        // Create the CBOR with PromiseGrid tag
        let cbor_data = self.encode_with_grid_tag(&message)
            .map_err(|e| JsValue::from_str(&format!("CBOR encoding error: {}", e)))?;

        Ok(cbor_data)
    }

    /// Parse a PromiseGrid message from CBOR bytes
    #[wasm_bindgen]
    pub fn parse_message(&self, cbor_bytes: &[u8]) -> Result<String, JsValue> {
        match self.decode_with_grid_tag(cbor_bytes) {
            Ok(message) => {
                let json = serde_json::to_string_pretty(&message)
                    .map_err(|e| JsValue::from_str(&format!("JSON serialization error: {}", e)))?;
                Ok(json)
            }
            Err(e) => Err(JsValue::from_str(&format!("CBOR parsing error: {}", e)))
        }
    }

    /// Log message to browser console for debugging
    #[wasm_bindgen]
    pub fn log_message(&self, cbor_bytes: &[u8]) {
        match self.parse_message(cbor_bytes) {
            Ok(json) => {
                web_sys::console::log_1(&format!("PromiseGrid Message: {}", json).into());
            }
            Err(e) => {
                web_sys::console::error_1(&format!("Error parsing message: {:?}", e).into());
            }
        }
    }
}

impl PromiseGridHandler {
    /// Encode message with PromiseGrid CBOR tag (0x67726964)
    fn encode_with_grid_tag(&self, message: &PromiseGridMessage) -> Result<Vec<u8>, serde_cbor::Error> {
        // First encode the message normally
        let message_cbor = serde_cbor::to_vec(message)?;
        
        // Then wrap it with the grid tag
        // Tag 0x67726964 is 'grid' in ASCII
        let grid_tag = 0x67726964u32;
        let tagged_value = serde_cbor::Value::Tag(grid_tag as u64, Box::new(
            serde_cbor::from_slice::<serde_cbor::Value>(&message_cbor)?
        ));
        
        serde_cbor::to_vec(&tagged_value)
    }

    /// Decode message with PromiseGrid CBOR tag
    fn decode_with_grid_tag(&self, cbor_bytes: &[u8]) -> Result<PromiseGridMessage, Box<dyn std::error::Error>> {
        let tagged_value: serde_cbor::Value = serde_cbor::from_slice(cbor_bytes)?;
        
        match tagged_value {
            serde_cbor::Value::Tag(tag, boxed_value) => {
                if tag == 0x67726964 {  // 'grid' tag
                    let message_cbor = serde_cbor::to_vec(&*boxed_value)?;
                    let message: PromiseGridMessage = serde_cbor::from_slice(&message_cbor)?;
                    Ok(message)
                } else {
                    Err(format!("Invalid tag: expected 0x67726964, got 0x{:x}", tag).into())
                }
            }
            _ => Err("Message is not tagged with PromiseGrid tag".into())
        }
    }
}

// Optional: Helper function to initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
