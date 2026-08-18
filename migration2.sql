CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    name TEXT,
    workspace TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir o admin principal se não existir
INSERT INTO system_users (email, password_hash, role, name, workspace)
VALUES ('kaiolima0510@gmail.com', 'Itskaio123#', 'admin', 'Kaio Lima', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir também a Ilana para já facilitar o acesso dela (caso queira usar o mesmo de antes, coloquei o login e senha iguais)
INSERT INTO system_users (email, password_hash, role, name, workspace)
VALUES ('ilana2026', 'ilana2026', 'user', 'Ilana', 'amigo')
ON CONFLICT (email) DO NOTHING;
