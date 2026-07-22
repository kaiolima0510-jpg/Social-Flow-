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

# 5. Configurar a aplicação Social Flow
echo "7. Configurando a aplicação Social Flow..."
cd /root/socialflow

# Copiar chaves geradas do Supabase para o .env da aplicação
if [ -f "/root/supabase_keys.env" ]; then
    source /root/supabase_keys.env
    # Se o arquivo .env não existir, cria a partir de um template
    if [ ! -f ".env" ]; then
        cp .env.example .env || touch .env
    fi
    # Atualizar variáveis no .env da aplicação
    sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=https://socialflow.livros.digital/supabase|g" .env
    sed -i "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|g" .env
    sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY|g" .env
fi

# 6. Rodar os contêineres da aplicação e do Caddy
echo "8. Construindo e iniciando a aplicação..."
docker compose up -d --build

echo "=== CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! ==="
echo "Acesse http://socialflow.livros.digital para validar (o SSL/HTTPS será ativado automaticamente em instantes)."
