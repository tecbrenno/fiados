# Sistema de Fiado - Mercadinho

Um sistema simples e eficiente para controle de vendas fiado em pequenos mercados e estabelecimentos. Desenvolvido com HTML, CSS, JavaScript (Vanilla JS), Vite para o ambiente de desenvolvimento e Firebase para persistência de dados em nuvem.

## Visão Geral

Este projeto oferece uma solução web para gerenciar:
* **Vendas Fiado:** Registro rápido de novas vendas com calculadora integrada e busca de produtos.
* **Clientes:** Cadastro e gerenciamento de clientes, com status de autorização para fiado.
* **Débitos:** Consulta de dívidas de clientes, com visualização de detalhes e registro de pagamentos.
* **Relatórios:** Visão geral de vendas e pagamentos do dia/mês.
* **Controle de Acesso:** Sistema de autenticação com usuários e perfis (usuário normal / administrador).

## Tecnologias Utilizadas

* **Frontend:**
    * HTML5
    * CSS3
    * JavaScript (Vanilla JS)
* **Ambiente de Desenvolvimento/Build:**
    * [Vite](https://vitejs.dev/)
    * [Node.js](https://nodejs.org/) e [npm](https://www.npmjs.com/)
* **Backend como Serviço (BaaS):**
    * [Firebase Authentication](https://firebase.google.com/docs/auth) (Autenticação de Usuários)
    * [Firebase Cloud Firestore](https://firebase.google.com/docs/firestore) (Banco de Dados NoSQL em Nuvem)
* **Deploy:**
    * [GitHub Pages](https://pages.github.com/)
    * [GitHub Actions](https://docs.github.com/en/actions) (para CI/CD)

## Configuração do Projeto

### 1. Pré-requisitos

Certifique-se de ter o Node.js (versão LTS recomendada) e o npm (que vem com o Node.js) instalados em sua máquina.

```bash
node -v
npm -v