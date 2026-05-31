# BioAgent 本地 scRNA 测试镜像（使用清华 pip 镜像）
FROM python:3.11-slim

ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_NO_CACHE_DIR=1

# 安装系统依赖 + scRNA 核心 Python 工具
RUN apt-get update && apt-get install -y --no-install-recommends g++ gcc && rm -rf /var/lib/apt/lists/* && \
    pip install --upgrade pip && \
    pip install scanpy anndata scrublet numpy scipy pandas matplotlib && \
    apt-get purge -y g++ gcc && apt-get autoremove -y

# 验证
RUN python -c "import scanpy; print('scanpy', scanpy.__version__)" && \
    python -c "import anndata; print('anndata', anndata.__version__)" && \
    python -c "import scrublet; print('scrublet OK')"

CMD ["sleep", "infinity"]
