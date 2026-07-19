USE ecommerce;

-- document_chunks: no rows exist yet (chunk-embed was a stub), so
-- NOT NULL + index can be applied immediately.
ALTER TABLE document_chunks MODIFY COLUMN embedding VECTOR(3072) NOT NULL;
ALTER TABLE document_chunks ADD VECTOR INDEX (embedding);

-- reviews: keep nullable for now. Sample reviews are inserted WITHOUT
-- embeddings and get their embeddings later via the Process Reviews button.
ALTER TABLE reviews MODIFY COLUMN embedding VECTOR(3072);