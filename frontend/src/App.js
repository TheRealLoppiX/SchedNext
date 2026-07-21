import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importação das Páginas de Cliente
import Landing from './pages/Landing';
import CadastroEmpresa from './pages/CadastroEmpresa';
import Login from './pages/Login';
import Barbeiros from './pages/Barbeiros';
import Agenda from './pages/Agenda';
import Cadastro from './pages/Cadastro';
import RecuperarSenha from './pages/RecuperarSenha';
import Dashboard from './pages/Dashboard';

// IMPORTAÇÃO DO COMPONENTE DE CONTA (BARBEARIA)
import AdminConta from './AdminConta'; 

// Importação dos Componentes de Estrutura
import Layout from './components/Layout';

// Importação das Páginas de Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBarbeiros from './pages/admin/AdminBarbeiros';
import LoginAdmin from './pages/admin/LoginAdmin';
import GestaoServicos from './pages/admin/GestaoServicos';
import AdminAgendamentos from './pages/admin/AdminAgendamentos';
import AdminEstoque from './pages/admin/AdminEstoque';
import AdminAcoes from './pages/admin/AdminAcoes';
import AdminAssinaturas from './pages/admin/AdminAssinaturas';
import AdminClientes from './pages/admin/AdminClientes';
import AdminUnidades from './pages/admin/AdminUnidades';
import AdminApiKeys from './pages/admin/AdminApiKeys';

// Base compartilhada de UX (toast, confirmação e ajuda) — ver auditoria de heurísticas
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import HelpButton from './components/HelpButton';


function App() {
  // Inicializa o estado diretamente do localStorage para evitar redirecionamentos indevidos no refresh
  const [empresaId, setEmpresaId] = useState(() => localStorage.getItem('empresaId'));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const verificarLogin = () => {
      const adminSalvo = localStorage.getItem('adminToken');
      if (adminSalvo) {
        try {
          const data = JSON.parse(adminSalvo);
          // Atualiza o estado e o storage para garantir sincronia
          setEmpresaId(data.empresa_id);
          localStorage.setItem('empresaId', data.empresa_id);
        } catch (e) {
          console.error("Erro ao processar token do admin:", e);
          deslogarAdmin();
        }
      }
      setCarregando(false);
    };

    verificarLogin();
  }, []);

  const deslogarAdmin = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('empresaId');
    setEmpresaId(null);
  };

  if (carregando) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'sans-serif' 
      }}>
        <h3>Carregando sistema...</h3>
      </div>
    );
  }

  return (
    <ToastProvider>
    <ConfirmProvider>
    <div style={appStyles}>
      <Router>
        <HelpButton />
        <Routes>
          {/* ================= ROTAS PÚBLICAS (SEM SIDEBAR) ================= */}
          <Route path="/" element={<Landing />} />
          <Route path="/cadastrar" element={<CadastroEmpresa setEmpresaLogada={setEmpresaId} />} />
          <Route path="/:empresaSlug" element={<Login />} />
          <Route path="/:empresaSlug/login" element={<Login />} />
          <Route path="/:empresaSlug/cadastro" element={<Cadastro />} />
          <Route path="/:empresaSlug/recuperar-senha" element={<RecuperarSenha />} />
          
          <Route 
            path="/admin/login" 
            element={
              empresaId ? <Navigate to="/admin/dashboard" /> : <LoginAdmin setEmpresaLogada={setEmpresaId} />
            } 
          />

          {/* ================= ROTAS COM SIDEBAR (LAYOUT ÚNICO) ================= */}
          <Route element={<Layout setEmpresaId={setEmpresaId} />}>
            
            {/* --- Rotas do Cliente --- */}
            <Route path="/:empresaSlug/barbeiros" element={<Barbeiros />} />
            <Route path="/:empresaSlug/agenda" element={<Agenda />} />
            <Route path="/:empresaSlug/perfil" element={<Dashboard />} />
            
            {/* --- Rotas do Administrador (Protegidas) --- */}
            <Route 
              path="/admin/dashboard" 
              element={
                empresaId ? (
                  <AdminDashboard empresaId={empresaId} onLogout={deslogarAdmin} />
                ) : (
                  <Navigate to="/admin/login" />
                )
              } 
            />

            <Route 
              path="/admin/barbeiros" 
              element={
                empresaId ? (
                  <AdminBarbeiros empresaId={empresaId} />
                ) : (
                  <Navigate to="/admin/login" />
                )
              } 
            />

            <Route 
              path="/admin/servicos" 
              element={empresaId ? <GestaoServicos empresaId={empresaId} /> : <Navigate to="/admin/login" />} 
            />

            {/* ROTA DE CONFIGURAÇÕES DA CONTA (BARBEARIA) ADICIONADA E PROTEGIDA */}
            <Route 
              path="/admin/conta" 
              element={empresaId ? <AdminConta empresaId={empresaId} /> : <Navigate to="/admin/login" />} 
            />
              <Route 
                path="/admin/estoque" 
                element={empresaId ? <AdminEstoque empresaId={empresaId} /> : <Navigate to="/admin/login" />} 
              />
        

            <Route path="/admin/agendamentos" element={empresaId ? <AdminAgendamentos empresaId={empresaId} /> : <Navigate to="/admin/login" />} />
        
            {/* ROTA DE AÇÕES ADICIONADA AQUI DENTRO, COM PROTEÇÃO */}
            <Route path="/admin/acoes" element={empresaId ? <AdminAcoes /> : <Navigate to="/admin/login" />} />

            <Route path="/admin/clientes" element={empresaId ? <AdminClientes empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

            <Route path="/admin/assinaturas" element={empresaId ? <AdminAssinaturas empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

            <Route path="/admin/unidades" element={empresaId ? <AdminUnidades empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

            <Route path="/admin/api-keys" element={empresaId ? <AdminApiKeys empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

          </Route>
              
          {/* Redirecionamento de segurança para qualquer rota Admin não mapeada */}
          <Route path="/admin/*" element={<Navigate to="/admin/login" />} />
          
          {/* Rota 404 básica ou redirecionamento */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}

const appStyles = {
  minHeight: '100vh',
  backgroundColor: '#f0f2f5',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
};

export default App;