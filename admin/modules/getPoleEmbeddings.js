const { generateEmbedding } = require('../services/embeddingServices');

let poleEmbeddings = null;
async function getPoleEmbeddings() {
  if (!poleEmbeddings) {
    const [positive, negative] = await Promise.all([
      generateEmbedding('things customers love and praise about this product'),
      generateEmbedding('things customers complain about, dislike, or had problems with this product')
    ]);
    poleEmbeddings = { positive, negative };
  }
  return poleEmbeddings;
}

module.exports = getPoleEmbeddings;