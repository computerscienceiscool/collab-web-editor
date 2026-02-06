// Example integration with githubCommitDialog.js

async function getAICommitMessage(oldContent, newContent, apiKey) {
    try {
        // Wait for WASM to be ready
        await new Promise((resolve) => {
            Grokker.ready(resolve);
        });
        
        // Generate diff (or use a diff library like diff-match-patch)
        // For simplicity, we'll just pass the old and new content
        
        // Call WASM function
        const result = await Grokker.generateCommitMessage({
            oldContent: oldContent,
            newContent: newContent,
            apiKey: apiKey,
            model: "gpt-4"  // or user preference
        });
        
        // Display to user
        displayCommitMessage(result.title, result.body);
        
        return result;
        
    } catch (error) {
        console.error('Error generating commit message:', error);
        
        // Show user-friendly error message
        const errorMessage = getErrorMessage(error.code);
        displayError(errorMessage);
        
        throw error;
    }
}

function getErrorMessage(code) {
    const messages = {
        'INVALID_INPUT': 'Invalid input. Please check your diff and try again.',
        'OPENAI_API_ERROR': 'Failed to connect to OpenAI. Please check your API key.',
        'TOKEN_LIMIT_ERROR': 'The diff is too large. Try with a smaller change.',
        'NETWORK_ERROR': 'Network error. Please check your internet connection.',
        'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
    };
    return messages[code] || messages['UNKNOWN_ERROR'];
}

function displayCommitMessage(title, body) {
    // Populate UI fields
    document.getElementById('commit-title').value = title;
    document.getElementById('commit-body').value = body;
    
    // Enable commit button
    document.getElementById('commit-button').disabled = false;
}

function displayError(message) {
    // Show error in UI
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// Feature detection
function supportsWASM() {
    try {
        if (typeof WebAssembly === "object" &&
            typeof WebAssembly.instantiate === "function") {
            const module = new WebAssembly.Module(
                Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
            );
            if (module instanceof WebAssembly.Module) {
                return true;
            }
        }
    } catch (e) {}
    return false;
}

// Check for WASM support when the page loads
document.addEventListener('DOMContentLoaded', function() {
    if (!supportsWASM()) {
        console.warn('WebAssembly not supported. Falling back to manual commit messages.');
        // Hide AI commit message button
        const aiButton = document.getElementById('ai-commit-btn');
        if (aiButton) {
            aiButton.style.display = 'none';
        }
    }
});
