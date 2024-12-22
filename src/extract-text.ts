import { Readability } from '@mozilla/readability';

// Attach to window instead of exporting
(window as any).runReadability = function () {
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone);
    const article = reader.parse();
    return article;
};