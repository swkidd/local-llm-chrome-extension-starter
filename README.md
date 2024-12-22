# Local LLM Chrome Extension Starter

A Chrome extension that brings the power of local LLMs directly to your browser using WebLLM and LangChain. This extension implements a RAG (Retrieval Augmented Generation) system that runs entirely in your browser, allowing you to ask questions about any webpage without sending data to external servers.

## Features

- 🚀 Runs LLMs completely locally in your browser
- 🔍 Implements RAG (Retrieval Augmented Generation) for accurate, context-aware responses
- 📝 Processes webpage content automatically using Readability
- 🧠 Uses efficient vector embeddings for semantic search
- 🏷️ Memory-efficient design with per-tab vector stores
- 💨 Built with Vite and CRXJS for modern development experience
- 🎨 Styled with Tailwind CSS
- 📱 TypeScript support for better development experience

## Prerequisites

- Node.js (v14 or higher)
- Chrome browser (v88 or higher)
- Git

## Technology Stack

- WebLLM (@mlc-ai/web-llm) for running LLMs in the browser
- LangChain.js for RAG implementation
- Mozilla's Readability for content extraction
- React for UI components
- Tailwind CSS for styling
- TypeScript for type safety
- Vite + CRXJS for building

## Installation

1. Clone the repository:
```bash
git clone https://github.com/swkidd/local-llm-chrome-extension-starter
cd local-llm-chrome-extension-starter
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` directory from your project

NOTE: HRM hot reloading is possible through CRXJS. See https://crxjs.dev/vite-plugin for details.

## Development

Start the development server:
```bash
npm run dev
```

The extension will automatically reload when you make changes to the code.

## How It Works

The extension uses a two-model approach for efficient question answering:

1. **Content Processing:**
   - Extracts clean content from webpages using Readability
   - Splits content into manageable chunks
   - Creates embeddings using a lightweight embedding model

2. **Question Answering:**
   - Uses vector similarity to find relevant content chunks
   - Processes queries using a local LLM
   - Maintains separate vector stores for each tab for efficiency

3. **Memory Management:**
   - Implements LRU (Least Recently Used) caching for vector stores
   - Automatically cleans up unused vector stores
   - Limits maximum number of stored pages

## Project Structure

```
├── src/
│   ├── content.jsx           # Dummy content script, customize to add content to the current page
│   ├── service-worker.js     # Service worker running the local llm and vector store
│   └── App.tsx         # Extension popup UI that sends content to the service worker and accepts queries
└── manifest.json       # Extension manifest
```

## Configuration

The extension can be configured by modifying the following files:

- `src/background/service-worker.ts`: Adjust model parameters and memory limits
- `manifest.json`: Extension permissions and metadata
- `tailwind.config.js`: UI styling configuration

See https://crxjs.dev/vite-plugin for more information about how to customize the extension

## Models

The extension uses two models:
- Embedding Model: `snowflake-arctic-embed-m-q0f32-MLC-b4`
- Chat Model: `SmolLM2-360M-Instruct-q4f16_1-MLC` 

The default chat model is very small at ~360MB. This model should run in most environments but is not as powerful as larger models. The model can easily be changed by changing the `CHAT_MODEL` variable in `service-worker.js`. A full list of Web-LLM compatible models can be found here: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts#L293. Also refer to the web-llm docs: https://webllm.mlc.ai/docs/user/basic_usage.html

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) for making it possible to run LLMs in the browser
- [LangChain](https://js.langchain.com/) for the RAG implementation tools
- [Mozilla's Readability](https://github.com/mozilla/readability) for content extraction
- [CRXJS](https://crxjs.dev/vite-plugin) for the excellent Vite plugin

## Support

For support, please open an issue on the GitHub repository.
