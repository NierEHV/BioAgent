---
title: "scRNA-seq Cell Annotation Strategies"
topic: "scrna-seq.annotation"
version: 1
updated: 2026-05-31
sources:
  - doi: "10.1038/s41576-023-00586-w"
  - url: "https://www.celltypist.org/"
tags: [cell-annotation, celltypist, singler, marker-genes, cell-types]
related:
  - omics/scrna-seq/overview.md
  - omics/scrna-seq/clustering-guide.md
  - tools/scanpy.md
confidence: high
---

# scRNA-seq Cell Annotation Strategies

Cell annotation assigns biological cell type identities to clusters. A combined approach of automated methods + manual marker validation gives the most reliable results.

## Three-Tier Annotation Strategy

### Tier 1: Automated Reference-Based Annotation (First Pass)

Use tools that map cells to curated reference atlases. This gives a rapid, unbiased first pass.

**CellTypist** (recommended for human/mouse immune cells):
```python
import celltypist
from celltypist import models

# Download and use a model
models.download_models(model='Human_Immune')
predictions = celltypist.annotate(adata, model='Human_Immune', majority_voting=True)
adata.obs['celltypist_label'] = predictions.predicted_labels['majority_voting']
```

**SingleR** (broader reference coverage, R):
```r
library(SingleR)
ref <- celldex::HumanPrimaryCellAtlasData()
pred <- SingleR(test = assay(sce), ref = ref, labels = ref$label.main)
sce$singler_label <- pred$labels
```

### Tier 2: Marker Gene Manual Validation (Second Pass)

Every automated prediction must be validated against canonical markers.

**Key immune cell markers:**
| Cell Type | Markers |
|-----------|---------|
| T cells (pan) | CD3E, CD3D, CD3G |
| CD4+ T cells | CD4, IL7R |
| CD8+ T cells | CD8A, CD8B, GZMK |
| B cells | CD19, MS4A1 (CD20), CD79A |
| NK cells | NKG7, GNLY, KLRD1 |
| Monocytes | CD14, LYZ, S100A8 |
| Macrophages | CD68, ITGAM (CD11b) |
| Dendritic cells | FCER1A, CST3 |
| Plasma cells | MZB1, SDC1 (CD138) |

**Validation dotplot:**
```python
marker_dict = {
    'T cells': ['CD3E', 'CD3D'],
    'B cells': ['CD19', 'MS4A1'],
    'Myeloid': ['CD14', 'LYZ'],
    'NK cells': ['NKG7', 'GNLY'],
}
sc.pl.dotplot(adata, marker_dict, groupby='celltypist_label', dendrogram=True)
```

### Tier 3: Consensus Labeling

When automated methods disagree, use manual inspection:
1. Plot UMAP colored by each prediction method
2. For ambiguous clusters, inspect expression of lineage markers directly
3. If a cluster has mixed lineage markers, flag as possible doublet artifact

## Handling Uncertainty

- **Low confidence calls** (< 0.5 probability): label as `"Uncertain"` and report to user
- **Mixed clusters** (expressing markers from two lineages): check if doublet or real intermediate state
- **Novel/unannotated clusters**: label as `"Cluster_N"` until expert review

```python
# Filter low confidence predictions
low_conf_mask = predictions.predicted_labels['conf_score'] < 0.5
adata.obs.loc[low_conf_mask, 'celltypist_label'] = 'Uncertain'
```

## Tissue-Specific Considerations

- **Blood/PBMC:** Immune-focused references work well (CellTypist Immune)
- **Tumor:** Include both immune and non-immune markers; epithelial markers (EPCAM, KRT18) distinguish tumor from stroma
- **Brain:** Use brain-specific references (e.g., Allen Brain Atlas)
- **Development:** Expect transitional states; use trajectory-aware annotation

## Common Pitfalls

1. **Blind trust in automated annotation** — always validate with markers
2. **Using wrong reference** — human PBMC reference for mouse data gives garbage
3. **Ignoring batch effects in marker expression** — batch correction before annotation
4. **Over-annotating** — forcing every cluster into a known cell type; some clusters may be novel
5. **Missing rare populations** — automated methods may misclassify rare cells (<1%)
