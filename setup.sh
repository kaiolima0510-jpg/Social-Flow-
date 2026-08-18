#!/bin/bash
set -e

echo "=== INICIANDO INSTALAÇÃO E CONFIGURAÇÃO DA VPS ==="

# 1. Atualizar o sistema e instalar dependências básicas
echo "1. Atualizando pacotes do sistema..."
apt-get update -y
apt-get upgrade -y
apt-get install -y git curl wget unzip build-essential

# 2. Instalar Docker se não estiver instalado
if ! command -v docker &> /dev/null; then
    echo "2. Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "2. Docker já instalado."
fi

# 3. Criar rede compartilhada do Docker
echo "3. Criando rede Docker 'socialflow_net'..."
docker network create socialflow_net || true

# 4. Clonar e configurar o Supabase Oficial Auto-hospedado
if [ ! -d "/root/supabase" ]; then
    echo "4. Clonando repositório oficial do Supabase..."
    git clone --depth 1 https://github.com/supabase/supabase.git /root/supabase
fi

cd /root/supabase/docker
if [ ! -f ".env" ]; then
    echo "5. Configurando variáveis de ambiente do Supabase..."
    cp .env.example .env
    
    # Gerar senhas e chaves JWT seguras e aleatórias
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$(echo -n '{"role":"anon","iss":"supabase"}' | openssl base64 | tr -d '=' | tr '/+' '_-').$(echo -n '{"role":"anon","iss":"supabase"}' | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 | tr -d '=' | tr '/+' '_-')"
    SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$(echo -n '{"role":"service_role","iss":"supabase"}' | openssl base64 | tr -d '=' | tr '/+' '_-').$(echo -n '{"role":"service_role","iss":"supabase"}' | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 | tr -d '=' | tr '/+' '_-')"
    
    # Substituir no arquivo .env
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/g" .env
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/g" .env
    sed -i "s/ANON_KEY=.*/ANON_KEY=$ANON_KEY/g" .env
    sed -i "s/SERVICE_ROLE_KEY=.*/SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY/g" .env
    
    # Salvar chaves para que possamos usá-las na aplicação
    echo "SUPABASE_ANON_KEY=$ANON_KEY" > /root/supabase_keys.env
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> /root/supabase_keys.env
    echo "SUPABASE_JWT_SECRET=$JWT_SECRET" >> /root/supabase_keys.env
    echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> /root/supabase_keys.env
else
    echo "5. Supabase já configurado."
fi

# Conectar os serviços do Supabase à nossa rede compartilhada
if ! grep -q "socialflow_net" docker-compose.yml; then
    echo "Adicionando rede socialflow_net ao compose do Supabase..."
    # Ajuste simples para permitir que nossa rede veja o container do Kong do Supabase
    cat <<EOT >> docker-compose.yml

networks:
  default:
    name: socialflow_net
    external: true
EOT
fi

# Inicializar o Supabase
echo "6. Iniciando contêineres do Supabase..."
docker compose up -d

# Configurar a aplicação Social Flow
echo "7. Configurando a aplicação Social Flow..."
cd /root/socialflow

# Ler a chave REAL do Supabase diretamente do .env do Docker (fonte da verdade)
REAL_ANON_KEY=""
REAL_SERVICE_KEY=""
if [ -f "/root/supabase/docker/.env" ]; then
    REAL_ANON_KEY=$(grep "^ANON_KEY=" /root/supabase/docker/.env | cut -d'=' -f2)
    REAL_SERVICE_KEY=$(grep "^SERVICE_ROLE_KEY=" /root/supabase/docker/.env | cut -d'=' -f2)
fi

# Fallback: usar as chaves do supabase_keys.env se não encontrou
if [ -z "$REAL_ANON_KEY" ] && [ -f "/root/supabase_keys.env" ]; then
    source /root/supabase_keys.env
    REAL_ANON_KEY=$SUPABASE_ANON_KEY
    REAL_SERVICE_KEY=$SUPABASE_SERVICE_ROLE_KEY
fi

echo "   Chave ANON detectada: ${REAL_ANON_KEY:0:30}..."

# Atualizar variáveis no .env da aplicação com as chaves reais
sed -i "s|DOMAIN=.*|DOMAIN=socialflow.livros.digital|g" .env
sed -i "s|VITE_BACKEND_URL=.*|VITE_BACKEND_URL=https://socialflow.livros.digital|g" .env
sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=https://socialflow.livros.digital/supabase|g" .env
sed -i "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$REAL_ANON_KEY|g" .env
sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$REAL_SERVICE_KEY|g" .env

echo "   .env atualizado com chaves reais do Supabase."

# Remover caracteres de quebra de linha do Windows (CRLF -> LF) para evitar bugs no Caddy e Docker
sed -i 's/\r$//' .env
sed -i 's/\r$//' Caddyfile

echo "8. Restaurando schema do banco de dados e migrações..."
if [ -f "/root/socialflow/schema.sql" ]; then
    if [ -f "/root/supabase_keys.env" ]; then
        source /root/supabase_keys.env
        # Executa o schema SQL no banco do Supabase
        docker exec -e PGPASSWORD=$POSTGRES_PASSWORD -i supabase-db psql -U postgres -d postgres < /root/socialflow/schema.sql || echo "Aviso: Falha ao rodar schema (talvez já exista)"
    fi
fi

if [ -f "/root/socialflow/migration.sql" ]; then
    if [ -f "/root/supabase_keys.env" ]; then
        source /root/supabase_keys.env
        # Executa as migrações SQL no banco do Supabase
        docker exec -e PGPASSWORD=$POSTGRES_PASSWORD -i supabase-db psql -U postgres -d postgres < /root/socialflow/migration.sql || echo "Aviso: Falha ao rodar migração 1"
    fi
fi

if [ -f "/root/socialflow/migration2.sql" ]; then
    if [ -f "/root/supabase_keys.env" ]; then
        source /root/supabase_keys.env
        # Executa a migração 2
        docker exec -e PGPASSWORD=$POSTGRES_PASSWORD -i supabase-db psql -U postgres -d postgres < /root/socialflow/migration2.sql || echo "Aviso: Falha ao rodar migração 2"
    fi
fi

# 6. Rodar os contêineres da aplicação e do Caddy
echo "9. Construindo e iniciando a aplicação..."
docker compose up -d --build

echo "=== CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! ==="
echo "Acesse http://socialflow.livros.digital para validar (o SSL/HTTPS será ativado automaticamente em instantes)."
