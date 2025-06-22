// main.js

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

// ** CONFIGURAÇÕES DO FIREBASE VIA VARIÁVEIS DE AMBIENTE **
// Estas variáveis são injetadas pelo seu processo de build (ex: Vite).
// No ambiente de desenvolvimento, o Vite lê o arquivo .env automaticamente.
// Para o deploy em produção, o build do Vite irá embutir esses valores no código final.

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Opcional
};


// --- ADICIONE OS CONSOLE.LOG() AQUI ---
// console.log("Variáveis do Ambiente Firebase:");
// console.log("VITE_FIREBASE_API_KEY:", firebaseConfig.apiKey);
// console.log("VITE_FIREBASE_AUTH_DOMAIN:", firebaseConfig.authDomain);
// console.log("VITE_FIREBASE_PROJECT_ID:", firebaseConfig.projectId);
// console.log("VITE_FIREBASE_STORAGE_BUCKET:", firebaseConfig.storageBucket);
// console.log("VITE_FIREBASE_MESSAGING_SENDER_ID:", firebaseConfig.messagingSenderId);
// console.log("VITE_FIREBASE_APP_ID:", firebaseConfig.appId);
// console.log("VITE_FIREBASE_MEASUREMENT_ID:", firebaseConfig.measurementId); // Pode ser undefined se não estiver no .env


// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências para as coleções do Firestore
const usersCol = collection(db, 'users');
const clientesCol = collection(db, 'clientes');
const vendasCol = collection(db, 'vendas');
const pagamentosCol = collection(db, 'pagamentos');
const produtosCol = collection(db, 'produtos');

// Estado da aplicação
let clientes = [];
let vendas = [];
let pagamentos = [];
let produtos = [];
let users = [];
let selectedClient = null;

// Estado do usuário logado
let currentUser = null; // Objeto de usuário do Firebase Auth
let currentCustomUser = null; // Dados personalizados do usuário (nome, role, etc.)

// Estado da calculadora
let calcDisplay = '0';
let calcOperator = null;
let calcWaitingForOperand = false;
let calcValue = null;

// Estado da venda atual
let itensVenda = [];
let selectedProducts = [];

// Inicialização
window.onload = async function() {
    // Observador de estado de autenticação do Firebase
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário logado
            currentUser = user;
            // Buscar dados personalizados do usuário (role, name) no Firestore
            const userDoc = await getUserDataFromFirestore(user.email);
            if (userDoc) {
                currentCustomUser = { ...userDoc, username: user.email }; // Combine Firebase Auth user data with Firestore user data
                showMainApp();
            } else {
                // Se o usuário existir no Auth mas não no Firestore (primeiro login de um admin padrão, etc.)
                if (user.email === 'admin@example.com') { // Email padrão para o primeiro admin
                     const existingUserQuery = query(usersCol, where("email", "==", 'admin@example.com'));
                     const existingUserSnapshot = await getDocs(existingUserQuery);

                     if (existingUserSnapshot.empty) {
                        await addDoc(usersCol, {
                            uid: user.uid,
                            email: 'admin@example.com',
                            role: 'admin',
                            name: 'Administrador Principal',
                            createdAt: new Date().toISOString()
                        });
                        currentCustomUser = { uid: user.uid, email: 'admin@example.com', role: 'admin', name: 'Administrador Principal', username: 'admin@example.com' };
                        console.log('Admin inicial adicionado ao Firestore.');
                     } else {
                        currentCustomUser = { id: existingUserSnapshot.docs[0].id, ...existingUserSnapshot.docs[0].data(), username: user.email };
                     }
                     showMainApp();
                } else {
                    // Se o usuário não tem um registro no Firestore, forçar logout ou direcionar para completar perfil
                    alert('Seu perfil de usuário não está completo no sistema. Por favor, entre em contato com o administrador.');
                    logout();
                }
            }
        } else {
            // Usuário deslogado
            currentUser = null;
            currentCustomUser = null;
            showLoginScreen();
        }
    });

    // Carregar produtos iniciais se a coleção estiver vazia
    await carregarProdutosIniciais();
};

// Função para obter dados personalizados do usuário no Firestore
async function getUserDataFromFirestore(email) {
    const q = query(usersCol, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
    }
    return null;
}

// Sistema de Autenticação Firebase
function setupLoginForm() {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged irá lidar com showMainApp()
            document.getElementById('loginError').style.display = 'none';
        } catch (error) {
            console.error('Erro de login:', error.code, error.message);
            let errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Usuário ou senha incorretos!';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Formato de email inválido!';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
            }
            document.getElementById('loginError').textContent = errorMessage;
            document.getElementById('loginError').style.display = 'block';
            document.getElementById('password').value = '';
        }
    });
}

async function logout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        try {
            await signOut(auth);
            // onAuthStateChanged irá lidar com showLoginScreen()
        } catch (error) {
            console.error('Erro ao sair:', error);
            alert('Erro ao sair. Por favor, tente novamente.');
        }
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

async function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('currentUser').textContent = `Olá, ${currentCustomUser ? currentCustomUser.name : currentUser.email}`;
    
    // Mostrar aba de configurações apenas para admin
    if (currentCustomUser && currentCustomUser.role === 'admin') {
        document.getElementById('tabConfig').style.display = 'block';
    } else {
        document.getElementById('tabConfig').style.display = 'none';
    }
    
    // Carregar dados da aplicação (usando listeners em tempo real)
    setupFirestoreListeners();
    setupAutocomplete();
    setupClienteAutocomplete();

}

// Listeners em tempo real para Firestore
function setupFirestoreListeners() {
    onSnapshot(clientesCol, (snapshot) => {
        clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarListaClientes();
        atualizarSelectClientes();
        atualizarDebitos();
    });

    onSnapshot(vendasCol, (snapshot) => {
        vendas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarDebitos();
        atualizarRelatorios();
    });

    onSnapshot(pagamentosCol, (snapshot) => {
        pagamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        atualizarRelatorios();
        atualizarDebitos(); // Atualiza débitos após pagamentos também
    });

    onSnapshot(produtosCol, (snapshot) => {
        produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Não precisa chamar setupAutocomplete aqui, pois já é chamado na inicialização
    });

    onSnapshot(usersCol, (snapshot) => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentCustomUser && currentCustomUser.role === 'admin') {
            atualizarListaUsuarios();
        }
    });
}

// Funções de Persistência (agora usando Firebase Firestore)
async function addDocToFirestore(collectionRef, data) {
    try {
        const docRef = await addDoc(collectionRef, data);
        return { id: docRef.id, ...data }; // Retorna o documento com o ID gerado pelo Firestore
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        throw e;
    }
}

async function updateDocInFirestore(collectionRef, docId, data) {
    try {
        const docRef = doc(collectionRef, docId);
        await updateDoc(docRef, data);
    } catch (e) {
        console.error("Erro ao atualizar documento: ", e);
        throw e;
    }
}

async function deleteDocFromFirestore(collectionRef, docId) {
    try {
        const docRef = doc(collectionRef, docId);
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Erro ao deletar documento: ", e);
        throw e;
    }
}

async function carregarProdutosIniciais() {
     const snapshot = await getDocs(produtosCol);
     if (snapshot.empty) {
        console.log('Adicionando produtos padrão ao Firestore...');
        const produtosPadrao = [
            { nome: 'Arroz', categoria: 'Alimentos' }, { nome: 'Arroz integral', categoria: 'Alimentos' },
            { nome: 'Feijão preto', categoria: 'Alimentos' }, { nome: 'Feijão carioca', categoria: 'Alimentos' },
            { nome: 'Feijão branco', categoria: 'Alimentos' }, { nome: 'Açúcar cristal', categoria: 'Alimentos' },
            { nome: 'Açúcar refinado', categoria: 'Alimentos' }, { nome: 'Sal', categoria: 'Alimentos' },
            { nome: 'Farinha de trigo', categoria: 'Alimentos' }, { nome: 'Farinha de mandioca', categoria: 'Alimentos' },
            { nome: 'Fubá', categoria: 'Alimentos' }, { nome: 'Macarrão', categoria: 'Alimentos' },
            { nome: 'Macarrão instantâneo', categoria: 'Alimentos' }, { nome: 'Óleo de soja', categoria: 'Alimentos' },
            { nome: 'Azeite', categoria: 'Alimentos' }, { nome: 'Vinagre', categoria: 'Alimentos' },
            { nome: 'Café', categoria: 'Alimentos' }, { nome: 'Leite em pó', categoria: 'Alimentos' },
            { nome: 'Achocolatado', categoria: 'Alimentos' }, { nome: 'Biscoito cream cracker', categoria: 'Alimentos' },
            { nome: 'Biscoito recheado', categoria: 'Alimentos' }, { nome: 'Pão de forma', categoria: 'Alimentos' },
            { nome: 'Pão francês', categoria: 'Alimentos' }, { nome: 'Sardinha', categoria: 'Enlatados' },
            { nome: 'Atum', categoria: 'Enlatados' }, { nome: 'Milho verde', categoria: 'Enlatados' },
            { nome: 'Ervilha', categoria: 'Enlatados' }, { nome: 'Molho de tomate', categoria: 'Enlatados' },
            { nome: 'Extrato de tomate', categoria: 'Enlatados' }, { nome: 'Leite condensado', categoria: 'Enlatados' },
            { nome: 'Creme de leite', categoria: 'Enlatados' }, { nome: 'Coca-Cola', categoria: 'Bebidas' },
            { nome: 'Guaraná', categoria: 'Bebidas' }, { nome: 'Fanta', categoria: 'Bebidas' },
            { nome: 'Sprite', categoria: 'Bebidas' }, { nome: 'Água mineral', categoria: 'Bebidas' },
            { nome: 'Suco de laranja', categoria: 'Bebidas' }, { nome: 'Suco de uva', categoria: 'Bebidas' },
            { nome: 'Cerveja Skol', categoria: 'Bebidas' }, { nome: 'Cerveja Brahma', categoria: 'Bebidas' },
            { nome: 'Cerveja Antarctica', categoria: 'Bebidas' }, { nome: 'Cerveja Heineken', categoria: 'Bebidas' },
            { nome: 'Vinho', categoria: 'Bebidas' }, { nome: 'Cachaça', categoria: 'Bebidas' },
            { nome: 'Vodka', categoria: 'Bebidas' }, { nome: 'Whisky', categoria: 'Bebidas' }
        ];
        for (const produto of produtosPadrao) {
            await addDoc(produtosCol, produto);
        }
        console.log('Produtos padrão adicionados.');
     }
}


// Navegação entre seções
function showSection(sectionId) {
    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // Mostrar seção selecionada
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    // Os listeners do Firestore já atualizam os dados automaticamente
}

// Funções da Calculadora (não mudam)
function updateDisplay() {
    document.getElementById('calcDisplay').textContent = calcDisplay;
}

function addNumber(num) {
    if (calcWaitingForOperand) {
        calcDisplay = num;
        calcWaitingForOperand = false;
    } else {
        calcDisplay = calcDisplay === '0' ? num : calcDisplay + num;
    }
    updateDisplay();
}

function addDecimal() {
    if (calcWaitingForOperand) {
        calcDisplay = '0.';
        calcWaitingForOperand = false;
    } else if (!calcDisplay.includes('.')) {
        calcDisplay += '.';
    }
    updateDisplay();
}

function setOperator(nextOperator) {
    const inputValue = parseFloat(calcDisplay);

    if (calcValue === null) {
        calcValue = inputValue;
    } else if (calcOperator) {
        const currentValue = calcValue || 0;
        const newValue = calculate();
        calcDisplay = `${parseFloat(newValue.toFixed(2))}`;
        calcValue = newValue;
    }

    calcWaitingForOperand = true;
    calcOperator = nextOperator;
    updateDisplay();
}

function calculate() {
    const inputValue = parseFloat(calcDisplay);

    if (calcValue === null || calcOperator === null) {
        return inputValue;
    }

    let result;
    if (calcOperator === '+') {
        result = calcValue + inputValue;
    } else if (calcOperator === '-') {
        result = calcValue - inputValue;
    } else if (calcOperator === '*') {
        result = calcValue * inputValue;
    } else if (calcOperator === '/') {
        result = calcValue / inputValue;
    }

    calcDisplay = `${parseFloat(result.toFixed(2))}`;
    calcValue = null;
    calcOperator = null;
    calcWaitingForOperand = true;
    updateDisplay();
    
    return result;
}

function clearCalc() {
    calcDisplay = '0';
    calcOperator = null;
    calcWaitingForOperand = false;
    calcValue = null;
    updateDisplay();
}

function adicionarItem() {
    const valor = parseFloat(calcDisplay);
    if (valor > 0) {
        itensVenda.push({
            valor: valor,
            descricao: '' // Deixe a descrição vazia para ser preenchida ou autocompletada
        });
        atualizarListaItens(); // <--- Esta chamada é vital
        clearCalc();
    }
}

function atualizarListaItens() {
    const container = document.getElementById('itensCompra');
    container.innerHTML = ''; // Garante que a lista é limpa antes de ser repopulada

    let total = 0;

    itensVenda.forEach((item, index) => {
        total += item.valor;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-row';
        itemDiv.innerHTML = `
            <div class="autocomplete-container" style="flex: 1;">
                <input type="text" 
                    id="itemDesc${index}"
                    placeholder="Descrição do item..." 
                    value="${item.descricao}"  // <--- Linha corrigida aqui
                    onchange="atualizarDescricaoItem(${index}, this.value)"
                    autocomplete="off">
                <div id="itemSuggestions${index}" class="autocomplete-suggestions"></div>
            </div>
            <span style="min-width: 100px; text-align: right;">R$ ${item.valor.toFixed(2).replace('.', ',')}</span>
            <button class="btn-danger" onclick="removerItem(${index})">×</button>
        `;
        container.appendChild(itemDiv);
        
        // Configurar autocomplete para este item
        setupItemAutocomplete(index);
    });
    
    document.getElementById('totalCompra').textContent = total.toFixed(2).replace('.', ',');
}

function setupItemAutocomplete(index) {
    const input = document.getElementById(`itemDesc${index}`);
    const suggestions = document.getElementById(`itemSuggestions${index}`);
    let currentFocus = -1;
    
    if (!input) return;
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        
        if (value.length < 2) {
            suggestions.classList.remove('active');
            return;
        }
        
        const matches = produtos.filter(p => 
            p.nome.toLowerCase().includes(value)
        ).slice(0, 10);
        
        suggestions.innerHTML = '';
        currentFocus = -1;
        
        // Opção de adicionar novo produto
        const existeExato = produtos.some(p => 
            p.nome.toLowerCase() === value.toLowerCase()
        );
        
        if (!existeExato && value.length > 0) {
            const addDiv = document.createElement('div');
            addDiv.className = 'add-new-product';
            addDiv.innerHTML = `
                <strong>+ Adicionar "${value}"</strong> como novo produto
            `;
            
            addDiv.addEventListener('click', async function() { // Marcar como async
                const nomeFormatado = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                await addDocToFirestore(produtosCol, { // Salvar no Firestore
                    nome: nomeFormatado,
                    categoria: 'Outros'
                });
                // A lista de produtos será atualizada pelo listener do Firestore
                input.value = nomeFormatado;
                itensVenda[index].descricao = nomeFormatado;
                suggestions.classList.remove('active');
            });
            
            suggestions.appendChild(addDiv);
        }
        
        matches.forEach((produto) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <strong>${produto.nome}</strong>
                <span class="suggestion-category">${produto.categoria}</span>
            `;
            
            div.addEventListener('click', function() {
                input.value = produto.nome;
                itensVenda[index].descricao = produto.nome;
                suggestions.classList.remove('active');
            });
            
            suggestions.appendChild(div);
        });
        
        if (suggestions.innerHTML !== '') {
            suggestions.classList.add('active');
        } else {
            suggestions.classList.remove('active');
        }
    });
    
    input.addEventListener('keydown', function(e) {
        const items = suggestions.querySelectorAll('.suggestion-item, .add-new-product');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            addItemActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            addItemActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            }
        } else if (e.key === 'Tab') {
            suggestions.classList.remove('active');
        }
    });
    
    function addItemActive(items) {
        if (!items) return false;
        removeItemActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('selected');
    }
    
    function removeItemActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('selected');
        }
    }
    
    // Fechar ao clicar fora
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.remove('active');
        }
    });
}

function removerItem(index) {
    itensVenda.splice(index, 1);
    atualizarListaItens();
}

function cancelarVenda() {
    if (confirm('Deseja cancelar esta venda?')) {
        itensVenda = [];
        selectedProducts = [];
        document.getElementById('clienteVenda').value = '';
        document.getElementById('buscarClienteVenda').value = ''; // <--- LIMPA O CAMPO DE BUSCA VISÍVEL
        selectedClient = null; // Limpa o cliente selecionado
        document.getElementById('obsCompra').value = '';
        document.getElementById('selectedItems').innerHTML = '';
        document.getElementById('areaVenda').style.display = 'none';
        clearCalc();
        atualizarListaItens();
    }
}

async function finalizarVenda() {
    const clienteId = document.getElementById('clienteVenda').value;
    const obsInput = document.getElementById('obsCompra').value;
    
    // Combinar produtos selecionados com o texto livre
    const produtosSelecionados = selectedProducts.join(', ');
    const obs = produtosSelecionados ? 
        (obsInput ? `${produtosSelecionados}, ${obsInput}` : produtosSelecionados) : 
        obsInput;
    
    if (!clienteId) {
        alert('Selecione um cliente!');
        return;
    }
    
    if (itensVenda.length === 0) {
        alert('Adicione pelo menos um item!');
        return;
    }
    
    const cliente = clientes.find(c => c.id === clienteId);
    const total = itensVenda.reduce((sum, item) => sum + item.valor, 0);
    
    const venda = {
        clienteId: clienteId,
        clienteNome: cliente.nome,
        data: new Date().toISOString(),
        itens: itensVenda,
        total: total,
        observacoes: obs,
        status: 'pendente',
        dataPagamento: calcularDataPagamento(cliente.diaPagamento)
    };
    
    try {
        await addDocToFirestore(vendasCol, venda); // Adicionar ao Firestore
        
        // Mostrar mensagem de sucesso
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = 'Venda registrada com sucesso!';
        document.querySelector('.content').insertBefore(successMsg, document.querySelector('.content').firstChild);
        
        setTimeout(() => successMsg.remove(), 3000);
        
        // Limpar formulário
        cancelarVenda();
        // As atualizações de débito e relatório serão feitas pelos listeners
    } catch (error) {
        console.error('Erro ao salvar venda:', error);
        alert('Erro ao salvar venda. Por favor, tente novamente.');
    }
}

function calcularDataPagamento(diaPagamento) {
    const hoje = new Date();
    let dataPagamento = new Date(hoje.getFullYear(), hoje.getMonth(), diaPagamento);
    
    // Se o dia já passou este mês, ir para o próximo mês
    if (dataPagamento <= hoje) {
        dataPagamento.setMonth(dataPagamento.getMonth() + 1);
    }
    
    return dataPagamento.toISOString();
}

// Funções de Cliente
function mostrarFormCliente() {
    document.getElementById('formCliente').style.display = 'block';
}

function cancelarFormCliente() {
    document.getElementById('formCliente').style.display = 'none';
    document.getElementById('nomeCliente').value = '';
    document.getElementById('telefoneCliente').value = '';
    document.getElementById('diaPagamento').value = '';
    document.getElementById('clienteAutorizado').checked = true;
}

async function salvarCliente() {
    const nome = document.getElementById('nomeCliente').value.trim();
    const telefone = document.getElementById('telefoneCliente').value.trim();
    const diaPagamento = parseInt(document.getElementById('diaPagamento').value);
    const autorizado = document.getElementById('clienteAutorizado').checked;
    
    if (!nome || !telefone || !diaPagamento) {
        alert('Preencha todos os campos!');
        return;
    }
    
    if (diaPagamento < 1 || diaPagamento > 31) {
        alert('Dia de pagamento deve ser entre 1 e 31!');
        return;
    }
    
    const cliente = {
        nome: nome,
        telefone: telefone,
        diaPagamento: diaPagamento,
        autorizado: autorizado,
        dataCadastro: new Date().toISOString()
    };
    
    try {
        await addDocToFirestore(clientesCol, cliente); // Adicionar ao Firestore
        
        cancelarFormCliente();
        // As atualizações da lista e select serão feitas pelo listener
        
        // Mostrar mensagem de sucesso
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = 'Cliente cadastrado com sucesso!';
        document.querySelector('#clientes').insertBefore(successMsg, document.querySelector('#clientes').firstChild.nextSibling);
        
        setTimeout(() => successMsg.remove(), 3000);
    }
    catch (error) {
        console.error('Erro ao salvar cliente:', error);
        alert('Erro ao salvar cliente. Por favor, tente novamente.');
    }
}

function atualizarListaClientes() {
    const container = document.getElementById('listaClientes');
    container.innerHTML = '';
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum cliente cadastrado ainda.</p></div>';
        return;
    }
    
    clientes.forEach(cliente => {
        const debito = calcularDebitoCliente(cliente.id);
        const clienteDiv = document.createElement('div');
        clienteDiv.className = 'client-item';
        clienteDiv.innerHTML = `
            <div class="client-info">
                <h3>${cliente.nome}</h3>
                <p>📱 ${cliente.telefone} | 📅 Dia ${cliente.diaPagamento}</p>
                <p>${cliente.autorizado ? '✅ Autorizado' : '❌ Não autorizado'}</p>
            </div>
            <div style="text-align: right;">
                <p class="debt-amount">R$ ${debito.toFixed(2).replace('.', ',')}</p>
                <button onclick="verDetalhesCliente('${cliente.id}')" style="margin-top: 10px;">Ver Detalhes</button>
            </div>
        `;
        container.appendChild(clienteDiv);
    });
}

function atualizarSelectClientes() {
    const select = document.getElementById('clienteVenda');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome;
        select.appendChild(option);
    });
}

function calcularDebitoCliente(clienteId) {
    return vendas
        .filter(v => v.clienteId === clienteId && v.status === 'pendente')
        .reduce((total, venda) => total + venda.total, 0);
}

// Funções de Débitos
function atualizarDebitos() {
    const container = document.getElementById('listaDebitos');
    container.innerHTML = '';
    
    let totalGeral = 0;
    let totalDevedores = 0;
    let totalVencidoHoje = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const clientesComDebito = clientes.filter(cliente => {
        const debito = calcularDebitoCliente(cliente.id);
        return debito > 0;
    });
    
    if (clientesComDebito.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum débito pendente!</p></div>';
    } else {
        clientesComDebito.forEach(cliente => {
            const vendasCliente = vendas.filter(v => v.clienteId === cliente.id && v.status === 'pendente');
            const debito = vendasCliente.reduce((total, venda) => total + venda.total, 0);
            
            totalGeral += debito;
            totalDevedores++;
            
            // Verificar se tem venda vencida hoje
            vendasCliente.forEach(venda => {
                const dataVenc = new Date(venda.dataPagamento);
                dataVenc.setHours(0, 0, 0, 0);
                if (dataVenc <= hoje) {
                    totalVencidoHoje += venda.total;
                }
            });
            
            const proximaData = vendasCliente.length > 0 ? 
                new Date(Math.min(...vendasCliente.map(v => new Date(v.dataPagamento)))) : null;
            
            const clienteDiv = document.createElement('div');
            clienteDiv.className = 'card';
            clienteDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3>${cliente.nome}</h3>
                        <p>📱 ${cliente.telefone}</p>
                        <p>📅 Próximo vencimento: ${proximaData ? formatarData(proximaData) : 'N/A'}</p>
                        <p>${vendasCliente.length} venda(s) pendente(s)</p>
                    </div>
                    <div style="text-align: right;">
                        <p class="debt-amount">R$ ${debito.toFixed(2).replace('.', ',')}</p>
                        <div style="margin-top: 10px; display: flex; gap: 10px;">
                            <button onclick="verDetalhesDebito('${cliente.id}')">Detalhes</button>
                            <button class="btn-success" onclick="registrarPagamento('${cliente.id}', ${debito})">Pagar</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(clienteDiv);
        });
    }
    
    // Atualizar estatísticas
    document.getElementById('totalAberto').textContent = totalGeral.toFixed(2).replace('.', ',');
    document.getElementById('totalDevedores').textContent = totalDevedores;
    document.getElementById('vencidosHoje').textContent = totalVencidoHoje.toFixed(2).replace('.', ',');
}

function filtrarDebitos() {
    const busca = document.getElementById('buscarDebito').value.toLowerCase();
    const cards = document.querySelectorAll('#listaDebitos .card');
    
    cards.forEach(card => {
        const nome = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = nome.includes(busca) ? 'block' : 'none';
    });
}

function verDetalhesCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    const vendasCliente = vendas.filter(v => v.clienteId === clienteId);
    
    document.getElementById('modalClienteNome').textContent = cliente.nome;
    
    let html = `
        <p><strong>Telefone:</strong> ${cliente.telefone}</p>
        <p><strong>Dia de Pagamento:</strong> ${cliente.diaPagamento}</p>
        <p><strong>Status:</strong> ${cliente.autorizado ? 'Autorizado' : 'Não autorizado'}</p>
        <hr>
        <h3>Histórico de Compras</h3>
    `;
    
    if (vendasCliente.length === 0) {
        html += '<p>Nenhuma compra registrada.</p>';
    } else {
        html += '<div class="transaction-list">';
        vendasCliente.forEach(venda => {
            html += `
                <div class="transaction-item">
                    <p><strong>${formatarData(new Date(venda.data))}</strong></p>
                    <p>Total: R$ ${venda.total.toFixed(2).replace('.', ',')}</p>
                    <p>Status: ${venda.status === 'pendente' ? '⏳ Pendente' : '✅ Pago'}</p>
                    ${venda.observacoes ? `<p>Obs: ${venda.observacoes}</p>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    
    document.getElementById('modalClienteConteudo').innerHTML = html;
    document.getElementById('modalCliente').style.display = 'block';
}

function verDetalhesDebito(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    const vendasPendentes = vendas.filter(v => v.clienteId === clienteId && v.status === 'pendente');
    
    document.getElementById('modalClienteNome').textContent = `Débitos - ${cliente.nome}`;
    
    let html = '<div class="transaction-list">';
    let total = 0;
    
    vendasPendentes.forEach(venda => {
         // --- NOVO CONSOLE.LOG ADICIONADO AQUI ---
        console.log("Processando venda no modal:", venda);
        console.log("Tipo de venda.itens:", typeof venda.itens, "É array?", Array.isArray(venda.itens));
        // --- FIM DO NOVO CONSOLE.LOG ---

        total += venda.total;
        html += `
            <div class="card">
                <p><strong>Data:</strong> ${formatarData(new Date(venda.data))}</p>
                <p><strong>Vencimento:</strong> ${formatarData(new Date(venda.dataPagamento))}</p>
                <p><strong>Total:</strong> R$ ${venda.total.toFixed(2).replace('.', ',')}</p>
                ${venda.observacoes ? `<p><strong>Obs:</strong> ${venda.observacoes}</p>` : ''}
                <h4>Itens:</h4>
                <ul>
        `;
        
        if (venda.itens && Array.isArray(venda.itens)) {
            venda.itens.forEach(item => {
                // Garante que item.valor é um número antes de formatar
                const itemValor = parseFloat(item.valor || 0).toFixed(2).replace('.', ',');
                html += `<li>${item.descricao || 'Item sem descrição'} - R$ ${itemValor}</li>`;
            });
        } else {
            html += `<li>Nenhum item detalhado disponível ou formato inválido.</li>`; 
        }
        
        html += `
                </ul>
                <button class="btn-success" onclick="pagarVenda('${venda.id}')" style="margin-top: 10px;">
                    Pagar esta venda
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    html += `<div class="summary-box" style="margin-top: 20px;">
                <h2>Total Geral: R$ ${total.toFixed(2).replace('.', ',')}</h2>
                <button onclick="registrarPagamento('${clienteId}', ${total})" style="margin-top: 10px;">
                    Pagar Tudo
                </button>
             </div>`;
    
    document.getElementById('modalClienteConteudo').innerHTML = html;
    document.getElementById('modalCliente').style.display = 'block';
}

async function pagarVenda(vendaId) {
    if (confirm('Confirmar pagamento desta venda?')) {
        try {
            const vendaRef = doc(db, 'vendas', vendaId);
            await updateDoc(vendaRef, {
                status: 'pago',
                dataPagamentoReal: new Date().toISOString()
            });
            
            const venda = vendas.find(v => v.id === vendaId); // Pegar a venda atualizada localmente
            const pagamento = {
                vendaId: vendaId,
                clienteId: venda.clienteId,
                valor: venda.total,
                data: new Date().toISOString()
            };
            
            await addDocToFirestore(pagamentosCol, pagamento); // Adicionar ao Firestore
            
            fecharModal();
            // As atualizações serão feitas pelos listeners
            
            // Mostrar mensagem de sucesso
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = 'Pagamento registrado com sucesso!';
            document.querySelector('.content').insertBefore(successMsg, document.querySelector('.content').firstChild);
            
            setTimeout(() => successMsg.remove(), 3000);
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            alert('Erro ao registrar pagamento. Por favor, tente novamente.');
        }
    }
}

async function registrarPagamento(clienteId, valor) {
    if (confirm(`Confirmar pagamento de R$ ${valor.toFixed(2).replace('.', ',')}?`)) {
        try {
            const vendasClientePendentes = vendas.filter(v => v.clienteId === clienteId && v.status === 'pendente');
            
            for (const venda of vendasClientePendentes) {
                const vendaRef = doc(db, 'vendas', venda.id);
                await updateDoc(vendaRef, {
                    status: 'pago',
                    dataPagamentoReal: new Date().toISOString()
                });
                
                const pagamento = {
                    vendaId: venda.id,
                    clienteId: clienteId,
                    valor: venda.total,
                    data: new Date().toISOString()
                };
                
                await addDocToFirestore(pagamentosCol, pagamento); // Adicionar ao Firestore
            }
            
            fecharModal();
            // As atualizações serão feitas pelos listeners
            
            // Mostrar mensagem de sucesso
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = 'Pagamento total registrado com sucesso!';
            document.querySelector('.content').insertBefore(successMsg, document.querySelector('.content').firstChild);
            
            setTimeout(() => successMsg.remove(), 3000);
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            alert('Erro ao registrar pagamento. Por favor, tente novamente.');
        }
    }
}

// Funções de Relatório
function atualizarRelatorios() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const mesAtual = new Date();
    mesAtual.setDate(1);
    mesAtual.setHours(0, 0, 0, 0);
    
    // Vendas de hoje
    const vendasHoje = vendas.filter(v => {
        const dataVenda = new Date(v.data);
        dataVenda.setHours(0, 0, 0, 0);
        return dataVenda.getTime() === hoje.getTime();
    });
    
    // Vendas do mês
    const vendasMes = vendas.filter(v => {
        const dataVenda = new Date(v.data);
        return dataVenda >= mesAtual;
    });
    
    // Pagamentos de hoje
    const pagamentosHoje = pagamentos.filter(p => {
        const dataPag = new Date(p.data);
        dataPag.setHours(0, 0, 0, 0);
        return dataPag.getTime() === hoje.getTime();
    });

    // --- NOVOS CONSOLE.LOGS ADICIONADOS AQUI ---
    // console.log("---------- DEBUG ATUALIZAR RELATÓRIOS ----------");
    // console.log("Array vendas:", vendas);
    // console.log("Array pagamentos:", pagamentos);
    // console.log("Vendas Hoje:", vendasHoje);
    // console.log("Vendas Mês:", vendasMes);
    // console.log("Pagamentos Hoje:", pagamentosHoje);
    // console.log("--------------------------------------------------");
    // --- FIM DOS NOVOS CONSOLE.LOGS ---
    
    const totalVendasHoje = vendasHoje.reduce((total, v) => total + (v.total || 0), 0);
    const totalVendasMes = vendasMes.reduce((total, v) => total + (v.total || 0), 0);
    const totalRecebidoHoje = pagamentosHoje.reduce((total, p) => total + (p.valor || 0), 0);

     // --- NOVOS CONSOLE.LOGS ADICIONADOS AQUI ---
    // console.log("Total Vendas Hoje:", totalVendasHoje);
    // console.log("Total Vendas Mês:", totalVendasMes);
    // console.log("Total Recebido Hoje:", totalRecebidoHoje);
    // console.log("--------------------------------------------------");
    // --- FIM DOS NOVOS CONSOLE.LOGS ---
    
    document.getElementById('vendasHoje').textContent = totalVendasHoje.toFixed(2).replace('.', ','); // Linha 1054
    document.getElementById('vendasMes').textContent = totalVendasMes.toFixed(2).replace('.', ',');
    document.getElementById('recebidoHoje').textContent = totalRecebidoHoje.toFixed(2).replace('.', ',');
    
    // Histórico de transações
    const todasTransacoes = [
        ...vendas.map(v => ({...v, tipo: 'venda'})),
        ...pagamentos.map(p => ({...p, tipo: 'pagamento'}))
    ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 20);
    
    const container = document.getElementById('historicoTransacoes');
    container.innerHTML = '';

    if (todasTransacoes.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhuma transação registrada.</p></div>';
    } else {
        todasTransacoes.forEach(trans => { // Esta é a linha que pode estar em 1061
            const div = document.createElement('div');
            div.className = 'transaction-item';
            
            // Use uma variável temporária e garanta que é um número
            let valorExibido;

            if (trans.tipo === 'venda') {
                const cliente = clientes.find(c => c.id === trans.clienteId);
                valorExibido = (trans.total || 0); // Garante que é 0 se undefined/null
                div.innerHTML = `
                    <p><strong>📝 Venda</strong> - ${formatarDataHora(new Date(trans.data))}</p>
                    <p>Cliente: ${cliente ? cliente.nome : 'Desconhecido'}</p>
                    <p>Valor: R$ ${parseFloat(valorExibido).toFixed(2).replace('.', ',')}</p>
                `;
            } else { // trans.tipo === 'pagamento'
                const cliente = clientes.find(c => c.id === trans.clienteId);
                valorExibido = (trans.valor || 0); // Garante que é 0 se undefined/null
                div.innerHTML = `
                    <p><strong>💰 Pagamento</strong> - ${formatarDataHora(new Date(trans.data))}</p>
                    <p>Cliente: ${cliente ? cliente.nome : 'Desconhecido'}</p>
                    <p>Valor: R$ ${parseFloat(valorExibido).toFixed(2).replace('.', ',')}</p>
                `;
            }
            
            container.appendChild(div);
        });
    }
}

// Funções auxiliares
function formatarData(data) {
    return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
    return data.toLocaleString('pt-BR');
}

function fecharModal() {
    document.getElementById('modalCliente').style.display = 'none';
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modalCliente');
    if (event.target === modal) {
        fecharModal();
    }
}

// Formatação automática do telefone (não muda)
document.getElementById('telefoneCliente').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 6) {
        value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
        value = `(${value}`;
    }
    
    e.target.value = value;
});

// Sistema de Autocomplete (adaptado para Firebase)
function setupAutocomplete() {
    const obsInput = document.getElementById('obsCompra');
    const suggestions = document.getElementById('autocompleteSuggestions');
    let currentFocus = -1;
    
    obsInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        const lastComma = value.lastIndexOf(',');
        const currentTerm = value.substring(lastComma + 1).trim();
        
        if (currentTerm.length < 2) {
            suggestions.classList.remove('active');
            return;
        }
        
        const matches = produtos.filter(p => 
            p.nome.toLowerCase().includes(currentTerm) &&
            !selectedProducts.includes(p.nome)
        ).slice(0, 10);
        
        suggestions.innerHTML = '';
        currentFocus = -1;
        
        // Se não houver correspondências exatas, mostrar opção de adicionar
        if (currentTerm.length >= 2) {
            const existeExato = produtos.some(p => 
                p.nome.toLowerCase() === currentTerm.toLowerCase()
            );
            
            if (!existeExato && currentTerm.length > 0) {
                const addDiv = document.createElement('div');
                addDiv.className = 'add-new-product';
                addDiv.innerHTML = `
                    <strong>+ Adicionar "${currentTerm}"</strong> como novo produto
                `;
                
                addDiv.addEventListener('click', function() {
                    adicionarNovoProduto(currentTerm);
                });
                
                suggestions.appendChild(addDiv);
            }
        }
        
        matches.forEach((produto, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <strong>${produto.nome}</strong>
                <span class="suggestion-category">${produto.categoria}</span>
            `;
            
            div.addEventListener('click', function() {
                selectProduct(produto.nome);
            });
            
            suggestions.appendChild(div);
        });
        
        if (suggestions.innerHTML !== '') {
            suggestions.classList.add('active');
        } else {
            suggestions.classList.remove('active');
        }
    });
    
    obsInput.addEventListener('keydown', function(e) {
        const items = suggestions.querySelectorAll('.suggestion-item, .add-new-product');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            } else if (this.value.trim()) { // Se pressionar Enter sem selecionar nada, adiciona o texto como item
                const value = this.value;
                const lastComma = value.lastIndexOf(',');
                const currentTerm = value.substring(lastComma + 1).trim();
                
                if (currentTerm.length > 0) {
                    selectProduct(currentTerm);
                }
            }
        }
    });
    
    function addActive(items) {
        if (!items) return false;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('selected');
    }
    
    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('selected');
        }
    }
    
    document.addEventListener('click', function(e) {
        if (!obsInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.remove('active');
        }
    });
}

function selectProduct(productName) {
    selectedProducts.push(productName);
    updateSelectedItems();
    document.getElementById('obsCompra').value = '';
    document.getElementById('autocompleteSuggestions').classList.remove('active');
}

function removeSelectedProduct(productName) {
    selectedProducts = selectedProducts.filter(p => p !== productName);
    updateSelectedItems();
}

function updateSelectedItems() {
    const container = document.getElementById('selectedItems');
    container.innerHTML = '';
    
    selectedProducts.forEach(product => {
        const div = document.createElement('div');
        div.className = 'selected-item';
        div.innerHTML = `
            ${product}
            <button onclick="removeSelectedProduct('${product}')">×</button>
        `;
        container.appendChild(div);
    });
}

// Funções de Gerenciamento de Usuários
function mostrarFormUsuario() {
    document.getElementById('formUsuario').style.display = 'block';
}

function cancelarFormUsuario() {
    document.getElementById('formUsuario').style.display = 'none';
    document.getElementById('nomeUsuario').value = '';
    document.getElementById('loginUsuario').value = '';
    document.getElementById('senhaUsuario').value = '';
    document.getElementById('tipoUsuario').value = 'user';
}

async function salvarUsuario() {
    const nome = document.getElementById('nomeUsuario').value.trim();
    const email = document.getElementById('loginUsuario').value.trim(); // Email como login
    const senha = document.getElementById('senhaUsuario').value;
    const tipo = document.getElementById('tipoUsuario').value;
    
    if (!nome || !email || !senha) {
        alert('Preencha todos os campos!');
        return;
    }
    
    // Verificar se usuário já existe no Firestore (para evitar duplicidade de email/username)
    const existingUserQuery = query(usersCol, where("email", "==", email));
    const existingUserSnapshot = await getDocs(existingUserQuery);
    if (!existingUserSnapshot.empty) {
        alert('Este email já está cadastrado para um usuário!');
        return;
    }

    try {
        // Criar usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const firebaseUser = userCredential.user;

        // Salvar dados adicionais do usuário no Firestore
        const novoUsuarioData = {
            uid: firebaseUser.uid, // Guardar o UID do Auth para referência
            email: email,
            role: tipo,
            name: nome,
            createdAt: new Date().toISOString(),
            createdBy: currentCustomUser ? currentCustomUser.email : 'system' // Quem criou o usuário
        };
        await addDocToFirestore(usersCol, novoUsuarioData);
        
        cancelarFormUsuario();
        // A atualização da lista de usuários será feita pelo listener
        
        // Mostrar mensagem de sucesso
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = 'Usuário cadastrado com sucesso!';
        document.querySelector('#configuracoes').insertBefore(successMsg, document.querySelector('#configuracoes').firstChild.nextSibling);
        
        setTimeout(() => successMsg.remove(), 3000);
    } catch (error) {
        console.error('Erro ao salvar usuário:', error.code, error.message);
        let errorMessage = 'Erro ao cadastrar usuário. Por favor, tente novamente.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está em uso por outra conta!';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        }
        alert(errorMessage);
    }
}

function atualizarListaUsuarios() {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    
    container.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'client-item';
        userDiv.innerHTML = `
            <div class="client-info">
                <h3>${user.name}</h3>
                <p>👤 Email: ${user.email}</p>
                <p>🔑 Tipo: ${user.role === 'admin' ? 'Administrador' : 'Usuário Normal'}</p>
            </div>
            <div style="text-align: right;">
                ${user.email !== (currentCustomUser ? currentCustomUser.email : '') && user.email !== 'admin@example.com' ? `
                    <button class="btn-danger" onclick="removerUsuario('${user.id}', '${user.email}', '${user.uid}')">Remover</button>
                ` : '<span style="color: #999;">Usuário protegido</span>'}
            </div>
        `;
        container.appendChild(userDiv);
    });
}

async function removerUsuario(docId, email, uid) {
    if (confirm(`Deseja remover o usuário ${email}? Isso o removerá do sistema, mas para remover totalmente do Firebase Authentication, um administrador precisará fazê-lo manualmente no console ou via um serviço de backend (ex: Cloud Function).`)) {
        try {
            // Remover do Firestore
            await deleteDocFromFirestore(usersCol, docId);
            
            // Para remover do Firebase Authentication (auth.deleteUser(uid)), seria necessário um contexto de servidor
            // (Cloud Functions ou SDK Admin), pois operações de Auth que modificam outros usuários não podem ser feitas diretamente do cliente.
            console.warn('Remoção do usuário do Firebase Authentication (auth.deleteUser) não pode ser feita diretamente do cliente. Por favor, remova-o manualmente no console do Firebase Auth, se necessário.');

            // A lista de usuários será atualizada pelo listener
        } catch (error) {
            console.error('Erro ao remover usuário:', error);
            alert('Erro ao remover usuário. Por favor, tente novamente.');
        }
    }
}

async function alterarSenha() {
    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;
    
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
        alert('Preencha todos os campos!');
        return;
    }
    
    if (novaSenha !== confirmarSenha) {
        alert('As senhas não coincidem!');
        return;
    }

    if (novaSenha.length < 6) {
        alert('A nova senha deve ter pelo menos 6 caracteres.');
        return;
    }
    
    // Re-autenticar o usuário para poder atualizar a senha (segurança do Firebase)
    const user = auth.currentUser;
    if (user) {
        const credential = await signInWithEmailAndPassword(auth, user.email, senhaAtual)
            .catch(error => {
                console.error('Erro de reautenticação:', error);
                alert('Senha atual incorreta! Por favor, re-digite sua senha atual para confirmar.');
                throw error; // Propagar o erro para parar a execução
            });
        
        try {
            await updatePassword(user, novaSenha); // Update password via Firebase Auth
            
            // Limpar campos
            document.getElementById('senhaAtual').value = '';
            document.getElementById('novaSenha').value = '';
            document.getElementById('confirmarSenha').value = '';
            
            alert('Senha alterada com sucesso!');
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            alert('Erro ao alterar senha. Por favor, tente novamente.');
        }
    } else {
        alert('Nenhum usuário logado. Por favor, faça login novamente.');
    }
}

async function adicionarNovoProduto(nome) {
    const nomeFormatado = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
    
    // Verificar se o produto já existe antes de adicionar
    const produtoExistenteQuery = query(produtosCol, where("nome", "==", nomeFormatado));
    const produtoExistenteSnapshot = await getDocs(produtoExistenteQuery);

    if (!produtoExistenteSnapshot.empty) {
        alert(`O produto "${nomeFormatado}" já existe na lista.`);
        selectProduct(nomeFormatado); // Seleciona se já existe
        return;
    }

    const novoProduto = {
        nome: nomeFormatado,
        categoria: 'Outros'
    };
    
    try {
        await addDocToFirestore(produtosCol, novoProduto);
        // A lista de produtos será atualizada pelo listener do Firestore
        
        // Selecionar o produto (se for no contexto da venda)
        selectProduct(nomeFormatado);
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        alert('Erro ao adicionar produto. Por favor, tente novamente.');
    }
}

function atualizarDescricaoItem(index, value) {
    if (itensVenda[index]) {
        itensVenda[index].descricao = value;
    }
}

// No main.js, adicione esta função em algum lugar após as definições das variáveis globais
function setupClienteAutocomplete() {
    const input = document.getElementById('buscarClienteVenda');
    const suggestionsContainer = document.getElementById('autocompleteClientesSuggestions');
    const hiddenClientIdInput = document.getElementById('clienteVenda');
    let currentFocus = -1;

    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        suggestionsContainer.innerHTML = '';
        currentFocus = -1;

        if (!value) {
            suggestionsContainer.classList.remove('active');
            return;
        }

        const matches = clientes.filter(cliente =>
            cliente.nome.toLowerCase().includes(value)
        ).slice(0, 10); // Limita a 10 sugestões

        if (matches.length === 0) {
            suggestionsContainer.classList.remove('active');
            return;
        }

        matches.forEach((cliente, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<strong><span class="math-inline">${cliente.nome}</strong\> <span\>\(</span>${cliente.telefone || 'Sem telefone'})</span>`;
            div.addEventListener('click', function() {
                input.value = cliente.nome;
                hiddenClientIdInput.value = cliente.id; // Define o ID do cliente no campo hidden
                selectedClient = cliente; // Armazena o objeto cliente completo
                suggestionsContainer.classList.remove('active');
                hiddenClientIdInput.dispatchEvent(new Event('change')); // Dispara o evento change para verificarClienteAutorizado
            });
            suggestionsContainer.appendChild(div);
        });

        suggestionsContainer.classList.add('active');
    });

    input.addEventListener('keydown', function(e) {
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            } else if (input.value.trim() && !selectedClient) {
                // Se Enter for pressionado e não há cliente selecionado, limpa o campo
                input.value = '';
                hiddenClientIdInput.value = '';
                selectedClient = null;
                hiddenClientIdInput.dispatchEvent(new Event('change'));
                suggestionsContainer.classList.remove('active');
            }
        } else if (e.key === 'Tab') {
            suggestionsContainer.classList.remove('active');
        }
    });

    function addActive(items) {
        if (!items) return false;
        removeItemActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('selected');
    }

    function removeItemActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('selected');
        }
    }

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.remove('active');
        }
    });

    // Limpar seleção se o usuário apagar o campo
    input.addEventListener('blur', () => {
        if (input.value === '') {
            hiddenClientIdInput.value = '';
            selectedClient = null;
            hiddenClientIdInput.dispatchEvent(new Event('change'));
        } else if (selectedClient && input.value !== selectedClient.nome) {
            // Se o usuário digitou algo diferente após selecionar
            hiddenClientIdInput.value = '';
            selectedClient = null;
            input.value = ''; // Limpa o campo se não for uma seleção válida
            hiddenClientIdInput.dispatchEvent(new Event('change'));
        }
    });
}

// No main.js
function verificarClienteAutorizado() {
    const clienteId = document.getElementById('clienteVenda').value; // Pega do input hidden
    // Use selectedClient para evitar outra busca na array clientes, se já estiver populado
    const cliente = selectedClient && selectedClient.id === clienteId ? selectedClient : clientes.find(c => c.id === clienteId);

    if (!clienteId || !cliente) { // Se nada foi selecionado ou o cliente não foi encontrado
        document.getElementById('areaVenda').style.display = 'none';
        document.getElementById('clienteNaoAutorizado').style.display = 'none';
        return;
    }

    if (cliente.autorizado) {
        document.getElementById('areaVenda').style.display = 'block';
        document.getElementById('clienteNaoAutorizado').style.display = 'none';
    } else {
        document.getElementById('areaVenda').style.display = 'none';
        document.getElementById('clienteNaoAutorizado').style.display = 'block';
    }
}

// Inicializa o formulário de login após o carregamento inicial do DOM
document.addEventListener('DOMContentLoaded', setupLoginForm);

// No main.js, no final do arquivo, ou após as definições das funções:

window.showSection = showSection;
window.logout = logout;
window.addNumber = addNumber;
window.addDecimal = addDecimal;
window.setOperator = setOperator;
window.calculate = calculate;
window.clearCalc = clearCalc;
window.verificarClienteAutorizado = verificarClienteAutorizado;
window.adicionarItem = adicionarItem;
window.removerItem = removerItem;
window.cancelarVenda = cancelarVenda;
window.finalizarVenda = finalizarVenda;
window.mostrarFormCliente = mostrarFormCliente;
window.cancelarFormCliente = cancelarFormCliente;
window.salvarCliente = salvarCliente;
window.filtrarDebitos = filtrarDebitos;
window.verDetalhesCliente = verDetalhesCliente;
window.verDetalhesDebito = verDetalhesDebito;
window.pagarVenda = pagarVenda;
window.registrarPagamento = registrarPagamento;
window.fecharModal = fecharModal;
window.mostrarFormUsuario = mostrarFormUsuario;
window.cancelarFormUsuario = cancelarFormUsuario;
window.salvarUsuario = salvarUsuario;
window.removerUsuario = removerUsuario;
window.alterarSenha = alterarSenha;
window.adicionarNovoProduto = adicionarNovoProduto;
window.atualizarDescricaoItem = atualizarDescricaoItem;
window.setupClienteAutocomplete = setupClienteAutocomplete; 
