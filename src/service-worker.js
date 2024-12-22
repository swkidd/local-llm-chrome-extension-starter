import * as webllm from "@mlc-ai/web-llm";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { formatDocumentsAsString } from "langchain/util/document";

let engine = null;
let isModelReady = false;

const EMBEDDING_MODEL = "snowflake-arctic-embed-m-q0f32-MLC-b4";
// const CHAT_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";
const CHAT_MODEL = "Phi-3.5-vision-instruct-q4f16_1-MLC";
const CHUNK_SIZE = 500;  // Size of each text chunk
const MAX_STORED_PAGES = 5;  // Maximum number of pages to keep in memory

// Store active ports and their associated data
const activePorts = new Set();
const portToTabId = new Map();
const tabToVectorStore = new Map();
const tabToContent = new Map();
const tabLastAccessed = new Map();

// WebLLM Embeddings class implementation
class WebLLMEmbeddings {
    engine;
    modelId;

    constructor(engine, modelId) {
        this.engine = engine;
        this.modelId = modelId;
    }

    async embedQuery(text) {
        const formattedQuery = `[CLS] Represent this sentence for searching relevant passages: ${text} [SEP]`;
        const reply = await this.engine.embeddings.create({
            input: [formattedQuery],
            model: this.modelId
        });
        return reply.data[0].embedding;
    }

    async embedDocuments(documents) {
        console.log('embedding document', documents);
        const formattedDocs = documents.map(doc => `[CLS] ${doc} [SEP]`);
        const reply = await this.engine.embeddings.create({
            input: formattedDocs,
            model: this.modelId
        });
        return reply.data.map(d => d.embedding);
    }
}

// Function to split text into chunks
function splitIntoChunks(text) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > CHUNK_SIZE) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        } else {
            currentChunk += " " + sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// Cleanup old vector stores to manage memory
function cleanupOldVectorStores() {
    if (tabToVectorStore.size <= MAX_STORED_PAGES) return;

    // Sort tabs by last accessed time
    const sortedTabs = Array.from(tabLastAccessed.entries())
        .sort((a, b) => b[1] - a[1]);

    // Remove oldest entries until we're at the limit
    while (tabToVectorStore.size > MAX_STORED_PAGES) {
        const [oldestTabId] = sortedTabs.pop();
        tabToVectorStore.delete(oldestTabId);
        tabToContent.delete(oldestTabId);
        tabLastAccessed.delete(oldestTabId);
        console.log(`Cleaned up vector store for tab ${oldestTabId}`);
    }
}

// Initialize engine with progress reporting
async function initializeEngine() {
    if (engine) return;

    try {
        engine = await webllm.CreateMLCEngine(
            [EMBEDDING_MODEL, CHAT_MODEL],
            {
                initProgressCallback: (progress) => {
                    console.log("Init progress:", progress);
                    for (const activePort of activePorts) {
                        activePort.postMessage({
                            type: "INIT_PROGRESS",
                            progress: progress.text || "Loading model..."
                        });
                    }
                },
                logLevel: "INFO"
            }
        );

        isModelReady = true;
        console.log("WebLLM models loaded successfully");

        // Process any pending content
        for (const [tabId, content] of tabToContent.entries()) {
            if (!tabToVectorStore.has(tabId)) {
                await processContent(content, tabId);
            }
        }

        for (const activePort of activePorts) {
            activePort.postMessage({ type: "MODEL_READY" });
        }
    } catch (error) {
        console.error("Failed to initialize models:", JSON.stringify(error));
        for (const activePort of activePorts) {
            activePort.postMessage({
                type: "ERROR",
                error: "Failed to initialize models: " + error.message
            });
        }
    }
}

// Process content and create vector store for a specific tab
async function processContent(content, tabId) {
    const chunks = splitIntoChunks(content);
    const documents = chunks.map(chunk => ({
        pageContent: chunk,
        metadata: {}
    }));

    // Initialize vector store with embeddings
    const vectorStore = await MemoryVectorStore.fromTexts(
        chunks,
        documents.map((_, i) => ({ id: i })),
        new WebLLMEmbeddings(engine, EMBEDDING_MODEL)
    );

    // Store the vector store and update last accessed time
    tabToVectorStore.set(tabId, vectorStore);
    tabLastAccessed.set(tabId, Date.now());

    // Cleanup old vector stores if needed
    cleanupOldVectorStores();
}

// RAG query processing
async function processQuery(question, tabId) {
    try {
        // Update last accessed time
        tabLastAccessed.set(tabId, Date.now());

        const vectorStore = tabToVectorStore.get(tabId);
        if (!vectorStore) {
            throw new Error("Vector store not found for this tab");
        }

        // Retrieve relevant documents
        const relevantDocs = await vectorStore.similaritySearch(question, 3);
        console.log('docs', relevantDocs);
        const context = formatDocumentsAsString(relevantDocs);

        // Create prompt with context
        const prompt = `Answer the question based only on the following context:
${context}

Question: ${question}

If the answer cannot be found in the context, say so clearly.`;

        // Get response from chat model
        const response = await engine.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant that answers questions based on provided context. Keep responses focused and accurate."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: CHAT_MODEL
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error processing query:", error);
        throw new Error("Failed to process query: " + error.message);
    }
}

// Set up connection handling
chrome.runtime.onConnect.addListener(async function (port) {
    console.log("New connection established");

    // Get the tab ID from the port name (should be set when connecting)
    const tabId = port.name;
    if (!tabId) {
        console.error("No tab ID provided in port name");
        return;
    }

    activePorts.add(port);
    portToTabId.set(port, tabId);

    if (!engine) {
        initializeEngine();
    } else if (isModelReady) {
        port.postMessage({ type: "MODEL_READY" });
    }

    port.onMessage.addListener(async (message) => {
        console.log("Received message:", message);
        try {
            if (message.type === "PAGE_CONTENT") {
                tabToContent.set(tabId, message.content);
                if (isModelReady) {
                    await processContent(message.content, tabId);
                }
                port.postMessage({ type: "CONTENT_RECEIVED" });
            } else if (message.type === "QUERY") {
                if (!isModelReady) {
                    port.postMessage({
                        type: "ERROR",
                        error: "Models are still loading, please wait..."
                    });
                    return;
                }

                if (!tabToVectorStore.has(tabId)) {
                    port.postMessage({
                        type: "ERROR",
                        error: "Content not processed yet for this tab"
                    });
                    return;
                }

                try {
                    const answer = await processQuery(message.question, tabId);
                    port.postMessage({
                        type: "ANSWER",
                        answer: answer
                    });
                } catch (error) {
                    console.error("Error processing query:", error);
                    port.postMessage({
                        type: "ERROR",
                        error: error.message || "Error processing query"
                    });
                }
            }
        } catch (error) {
            console.error("Message handling error:", error);
            port.postMessage({
                type: "ERROR",
                error: error.message || "Unknown error occurred"
            });
        }
    });

    port.onDisconnect.addListener(() => {
        console.log("Port disconnected");
        activePorts.delete(port);
        portToTabId.delete(port);
    });
});

// Service worker lifecycle events
self.addEventListener("install", (event) => {
    console.log("Service Worker installing.");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("Service Worker activating.");
});