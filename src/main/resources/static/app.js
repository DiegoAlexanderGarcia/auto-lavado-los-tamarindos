import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { authSettings, firebaseConfig, supabaseConfig } from './config.js';

const state = {
    employees: [],
    services: [],
    invoices: [],
    payouts: [],
    loanMovements: [],
    invoiceLines: []
};

const money = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const localDbKey = 'tamarindos-db-v1';
const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
const supabaseEnabled = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
const supabase = supabaseEnabled ? createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
const auth = firebaseEnabled ? getAuth(initializeApp(firebaseConfig)) : null;
let staticStorageMode = false;
let currentUser = null;
let registerMode = false;

const api = {
    async get(path) {
        if (supabaseEnabled) return supabaseApiGet(path);
        if (staticStorageMode) return localApiGet(path);
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('No se pudo cargar la informacion.');
            return response.json();
        } catch (error) {
            if (!path.startsWith('/api/')) throw error;
            staticStorageMode = true;
            toast('Modo Netlify: datos guardados en este navegador.');
            return localApiGet(path);
        }
    },
    async send(path, method, body) {
        if (supabaseEnabled) return supabaseApiSend(path, method, body);
        if (staticStorageMode) return localApiSend(path, method, body);
        try {
            const response = await fetch(path, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('No se pudo guardar la informacion.');
            if (response.status === 204) return null;
            return response.json();
        } catch (error) {
            if (!path.startsWith('/api/')) throw error;
            staticStorageMode = true;
            toast('Modo Netlify: datos guardados en este navegador.');
            return localApiSend(path, method, body);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindForms();
    bindAuth();
    setInitialDates();
    document.getElementById('refreshButton').addEventListener('click', loadData);
    document.getElementById('addLineButton').addEventListener('click', () => addInvoiceLine());
    document.getElementById('reportPeriod').addEventListener('change', renderReports);
    document.getElementById('reportDate').addEventListener('change', renderReports);
    document.getElementById('todayButton').addEventListener('click', () => {
        document.getElementById('reportDate').value = todayIso();
        renderReports();
    });
    startSession();
});

function bindAuth() {
    document.getElementById('authForm').addEventListener('submit', signInUser);
    document.getElementById('registerButton').addEventListener('click', startRegisterMode);
    document.getElementById('cancelRegisterButton').addEventListener('click', stopRegisterMode);
    document.getElementById('logoutButton').addEventListener('click', logoutUser);
}

function startSession() {
    if (!firebaseEnabled) {
        showApp();
        loadData();
        return;
    }
    showAuth();
    onAuthStateChanged(auth, user => {
        currentUser = user;
        if (user) {
            if (!userAllowed(user)) {
                signOut(auth);
                setAuthMessage('Este correo no esta autorizado para entrar.');
                return;
            }
            if (authSettings.requireEmailVerification && !user.emailVerified) {
                sendEmailVerification(user).catch(() => {});
                signOut(auth);
                setAuthMessage('Verifica tu correo antes de entrar. Te enviamos un enlace.');
                return;
            }
            showApp(user);
            loadData();
        } else {
            showAuth();
        }
    });
}

async function signInUser(event) {
    event.preventDefault();
    if (registerMode) {
        await registerUser();
        return;
    }
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        setAuthMessage('');
    } catch (error) {
        setAuthMessage('No se pudo iniciar sesion. Revisa correo y contrasena.');
    }
}

function startRegisterMode() {
    if (!authSettings.allowRegistration) {
        setAuthMessage('El registro esta cerrado. Crea usuarios desde Firebase.');
        return;
    }
    registerMode = true;
    document.getElementById('registerFields').hidden = false;
    document.getElementById('cancelRegisterButton').hidden = false;
    document.getElementById('registerButton').hidden = true;
    document.querySelector('#authForm .primary-button').textContent = 'Crear usuario';
    document.getElementById('authPassword').autocomplete = 'new-password';
    setAuthMessage('Crea tu usuario con una contrasena fuerte.');
}

function stopRegisterMode() {
    registerMode = false;
    document.getElementById('registerFields').hidden = true;
    document.getElementById('cancelRegisterButton').hidden = true;
    document.getElementById('registerButton').hidden = false;
    document.querySelector('#authForm .primary-button').textContent = 'Entrar';
    document.getElementById('authPassword').autocomplete = 'current-password';
    document.getElementById('authPasswordConfirm').value = '';
    setAuthMessage('');
}

async function registerUser() {
    if (!authSettings.allowRegistration) {
        setAuthMessage('El registro esta cerrado. Crea usuarios desde Firebase.');
        return;
    }
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const passwordConfirm = document.getElementById('authPasswordConfirm').value;
    if (!email || !password) {
        setAuthMessage('Escribe correo y contrasena para crear el usuario.');
        return;
    }
    if (!emailAllowed(email)) {
        setAuthMessage('Este correo no esta autorizado para registrarse.');
        return;
    }
    const passwordError = validatePassword(password, passwordConfirm);
    if (passwordError) {
        setAuthMessage(passwordError);
        return;
    }
    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (authSettings.requireEmailVerification) {
            await sendEmailVerification(credential.user);
            await signOut(auth);
            stopRegisterMode();
            setAuthMessage('Usuario creado. Revisa tu correo y verifica la cuenta antes de entrar.');
            return;
        }
        setAuthMessage('Usuario creado correctamente.');
    } catch (error) {
        setAuthMessage(firebaseErrorMessage(error));
    }
}

async function logoutUser() {
    if (auth) await signOut(auth);
}

function showAuth() {
    document.getElementById('authScreen').hidden = false;
    document.querySelectorAll('.app-view').forEach(element => element.classList.add('hidden'));
    document.getElementById('logoutButton').hidden = true;
    document.getElementById('sessionUser').textContent = '';
}

function showApp(user) {
    document.getElementById('authScreen').hidden = true;
    document.querySelectorAll('.app-view').forEach(element => element.classList.remove('hidden'));
    document.getElementById('logoutButton').hidden = !firebaseEnabled;
    document.getElementById('sessionUser').textContent = user?.email || (supabaseEnabled ? 'Supabase activo' : 'Modo local');
}

function setAuthMessage(message) {
    document.getElementById('authMessage').textContent = message;
}

function userAllowed(user) {
    return emailAllowed(user.email || '');
}

function emailAllowed(email) {
    const normalized = email.toLowerCase();
    const allowedEmails = (authSettings.allowedEmails || []).map(item => item.toLowerCase());
    if (allowedEmails.length && !allowedEmails.includes(normalized)) {
        return false;
    }
    if (authSettings.allowedEmailDomain && !normalized.endsWith(`@${authSettings.allowedEmailDomain.toLowerCase()}`)) {
        return false;
    }
    return true;
}

function validatePassword(password, passwordConfirm) {
    if (password !== passwordConfirm) {
        return 'Las contrasenas no coinciden.';
    }
    const minLength = authSettings.minPasswordLength || 12;
    if (password.length < minLength) {
        return `La contrasena debe tener minimo ${minLength} caracteres.`;
    }
    if (!/[a-z]/.test(password)) return 'Agrega al menos una letra minuscula.';
    if (!/[A-Z]/.test(password)) return 'Agrega al menos una letra mayuscula.';
    if (!/[0-9]/.test(password)) return 'Agrega al menos un numero.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Agrega al menos un simbolo.';
    return '';
}

function firebaseErrorMessage(error) {
    if (error.code === 'auth/email-already-in-use') return 'Ese correo ya esta registrado.';
    if (error.code === 'auth/operation-not-allowed') return 'Activa Email/Password en Firebase Authentication.';
    if (error.code === 'auth/invalid-email') return 'El correo no es valido.';
    if (error.code === 'auth/weak-password') return 'Firebase rechazo la contrasena por debil.';
    if (error.code === 'auth/unauthorized-domain') return 'Agrega tu dominio de Netlify en Firebase Authentication.';
    return 'No se pudo crear el usuario en Firebase.';
}

function bindTabs() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });
}

function bindForms() {
    document.getElementById('employeeForm').addEventListener('submit', saveEmployee);
    document.getElementById('serviceForm').addEventListener('submit', saveService);
    document.getElementById('invoiceForm').addEventListener('submit', saveInvoice);
    document.getElementById('loanForm').addEventListener('submit', saveLoanMovement);
}

function setInitialDates() {
    const today = todayIso();
    document.getElementById('reportDate').value = today;
    document.getElementById('loanDate').value = today;
}

async function supabaseApiGet(path) {
    if (path === '/api/summary') {
        const [employees, services, invoices, payouts, loanMovements] = await Promise.all([
            fetchSupabaseRows('employees', 'id'),
            fetchSupabaseRows('services', 'id'),
            fetchSupabaseInvoices(),
            fetchSupabaseRows('employee_payouts', 'created_at', false),
            fetchSupabaseRows('loan_movements', 'created_at', false)
        ]);
        return {
            employees: employees.map(fromEmployeeRow),
            services: services.map(fromServiceRow),
            invoices,
            payouts: payouts.map(fromPayoutRow),
            loanMovements: loanMovements.map(fromLoanMovementRow)
        };
    }
    throw new Error('Ruta de Supabase no soportada.');
}

async function supabaseApiSend(path, method, body) {
    if (path.startsWith('/api/employees')) {
        return supabaseSaveEmployee(path, method, body);
    }
    if (path.startsWith('/api/services')) {
        return supabaseSaveService(path, method, body);
    }
    if (path === '/api/invoices' && method === 'POST') {
        return supabaseSaveInvoice(body);
    }
    if (path === '/api/payouts' && method === 'POST') {
        return supabaseSavePayout(body);
    }
    if (path === '/api/loan-movements' && method === 'POST') {
        return supabaseSaveLoanMovement(body);
    }
    throw new Error('Ruta de Supabase no soportada.');
}

async function fetchSupabaseRows(table, orderColumn, ascending = true) {
    const { data, error } = await supabase.from(table).select('*').order(orderColumn, { ascending });
    if (error) throw error;
    return data || [];
}

async function fetchSupabaseInvoices() {
    const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_lines(*)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(fromInvoiceRow);
}

async function supabaseSaveEmployee(path, method, employee) {
    const id = Number(path.split('/').pop());
    if (method === 'DELETE') {
        const { error } = await supabase.from('employees').update({ active: false }).eq('id', id);
        if (error) throw error;
        return null;
    }
    const row = toEmployeeRow(employee);
    const query = method === 'PUT'
        ? supabase.from('employees').update(row).eq('id', id).select().single()
        : supabase.from('employees').insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return fromEmployeeRow(data);
}

async function supabaseSaveService(path, method, service) {
    const id = Number(path.split('/').pop());
    if (method === 'DELETE') {
        const { error } = await supabase.from('services').update({ active: false }).eq('id', id);
        if (error) throw error;
        return null;
    }
    const row = toServiceRow(service);
    const query = method === 'PUT'
        ? supabase.from('services').update(row).eq('id', id).select().single()
        : supabase.from('services').insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return fromServiceRow(data);
}

async function supabaseSaveInvoice(invoice) {
    const completedLines = invoice.lines.map(line => completeLocalLine({
        services: state.services,
        employees: state.employees
    }, line));
    const total = completedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const totalCommissions = completedLines.reduce((sum, line) => sum + line.employeeEarning, 0);
    const { data, error } = await supabase
        .from('invoices')
        .insert({
            customer_name: invoice.customerName,
            vehicle_plate: invoice.vehiclePlate,
            notes: invoice.notes,
            total,
            total_commissions: totalCommissions,
            business_net: total - totalCommissions
        })
        .select()
        .single();
    if (error) throw error;

    const { error: linesError } = await supabase.from('invoice_lines').insert(completedLines.map(line => ({
        invoice_id: data.id,
        service_id: line.serviceId,
        service_name: line.serviceName,
        employee_id: line.employeeId,
        employee_name: line.employeeName,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        commission_percent: line.commissionPercent,
        line_total: line.lineTotal,
        employee_earning: line.employeeEarning
    })));
    if (linesError) throw linesError;
    return { ...fromInvoiceRow(data), lines: completedLines };
}

async function supabaseSavePayout(payout) {
    const employee = state.employees.find(item => item.id === payout.employeeId);
    const { data, error } = await supabase
        .from('employee_payouts')
        .insert({
            employee_id: payout.employeeId,
            employee_name: employee?.name || '',
            work_date: payout.workDate,
            amount: payout.amount,
            notes: payout.notes
        })
        .select()
        .single();
    if (error) throw error;
    return fromPayoutRow(data);
}

async function supabaseSaveLoanMovement(movement) {
    const employee = state.employees.find(item => item.id === movement.employeeId);
    const { data, error } = await supabase
        .from('loan_movements')
        .insert({
            employee_id: movement.employeeId,
            employee_name: employee?.name || '',
            movement_date: movement.movementDate,
            type: movement.type === 'REPAYMENT' ? 'REPAYMENT' : 'LOAN',
            amount: movement.amount,
            notes: movement.notes
        })
        .select()
        .single();
    if (error) throw error;
    return fromLoanMovementRow(data);
}

function fromEmployeeRow(row) {
    return {
        id: Number(row.id),
        name: row.name,
        phone: row.phone || '',
        defaultCommissionPercent: Number(row.default_commission_percent || 0),
        active: row.active
    };
}

function fromServiceRow(row) {
    return {
        id: Number(row.id),
        name: row.name,
        category: row.category,
        price: Number(row.price || 0),
        active: row.active
    };
}

function fromInvoiceRow(row) {
    return {
        id: Number(row.id),
        customerName: row.customer_name,
        vehiclePlate: row.vehicle_plate || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        total: Number(row.total || 0),
        totalCommissions: Number(row.total_commissions || 0),
        businessNet: Number(row.business_net || 0),
        lines: (row.invoice_lines || []).map(fromInvoiceLineRow)
    };
}

function fromInvoiceLineRow(row) {
    return {
        serviceId: Number(row.service_id),
        serviceName: row.service_name,
        employeeId: Number(row.employee_id),
        employeeName: row.employee_name,
        quantity: Number(row.quantity || 1),
        unitPrice: Number(row.unit_price || 0),
        commissionPercent: Number(row.commission_percent || 0),
        lineTotal: Number(row.line_total || 0),
        employeeEarning: Number(row.employee_earning || 0)
    };
}

function fromPayoutRow(row) {
    return {
        id: Number(row.id),
        employeeId: Number(row.employee_id),
        employeeName: row.employee_name,
        workDate: row.work_date,
        amount: Number(row.amount || 0),
        notes: row.notes || '',
        createdAt: row.created_at
    };
}

function fromLoanMovementRow(row) {
    return {
        id: Number(row.id),
        employeeId: Number(row.employee_id),
        employeeName: row.employee_name,
        movementDate: row.movement_date,
        type: row.type,
        amount: Number(row.amount || 0),
        notes: row.notes || '',
        createdAt: row.created_at
    };
}

function toEmployeeRow(employee) {
    return {
        name: employee.name,
        phone: employee.phone,
        default_commission_percent: employee.defaultCommissionPercent,
        active: employee.active
    };
}

function toServiceRow(service) {
    return {
        name: service.name,
        category: service.category,
        price: service.price,
        active: service.active
    };
}

function localApiGet(path) {
    const db = readLocalDb();
    if (path === '/api/summary') return db;
    if (path === '/api/employees') return db.employees;
    if (path === '/api/services') return db.services;
    if (path === '/api/invoices') return db.invoices;
    if (path === '/api/payouts') return db.payouts;
    if (path === '/api/loan-movements') return db.loanMovements;
    throw new Error('Ruta local no soportada.');
}

function localApiSend(path, method, body) {
    const db = readLocalDb();
    const id = Number(path.split('/').pop());
    let result = null;

    if (path.startsWith('/api/employees')) {
        result = saveLocalEmployee(db, method, id, body);
    } else if (path.startsWith('/api/services')) {
        result = saveLocalService(db, method, id, body);
    } else if (path === '/api/invoices' && method === 'POST') {
        result = saveLocalInvoice(db, body);
    } else if (path === '/api/payouts' && method === 'POST') {
        result = saveLocalPayout(db, body);
    } else if (path === '/api/loan-movements' && method === 'POST') {
        result = saveLocalLoanMovement(db, body);
    } else {
        throw new Error('Ruta local no soportada.');
    }

    writeLocalDb(db);
    return result;
}

function saveLocalEmployee(db, method, id, employee) {
    if (method === 'DELETE') {
        const current = db.employees.find(item => item.id === id);
        if (current) current.active = false;
        return null;
    }
    if (method === 'PUT') {
        const current = db.employees.find(item => item.id === id);
        Object.assign(current, employee, { id });
        return current;
    }
    const created = { ...employee, id: db.nextEmployeeId++ };
    db.employees.push(created);
    return created;
}

function saveLocalService(db, method, id, service) {
    if (method === 'DELETE') {
        const current = db.services.find(item => item.id === id);
        if (current) current.active = false;
        return null;
    }
    if (method === 'PUT') {
        const current = db.services.find(item => item.id === id);
        Object.assign(current, service, { id });
        return current;
    }
    const created = { ...service, id: db.nextServiceId++ };
    db.services.push(created);
    return created;
}

function saveLocalInvoice(db, invoice) {
    const created = {
        ...invoice,
        id: db.nextInvoiceId++,
        createdAt: new Date().toISOString(),
        lines: invoice.lines.map(line => completeLocalLine(db, line))
    };
    created.total = created.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    created.totalCommissions = created.lines.reduce((sum, line) => sum + line.employeeEarning, 0);
    created.businessNet = created.total - created.totalCommissions;
    db.invoices.push(created);
    return created;
}

function saveLocalPayout(db, payout) {
    const employee = db.employees.find(item => item.id === payout.employeeId);
    const created = {
        ...payout,
        id: db.nextPayoutId++,
        employeeName: employee?.name || '',
        createdAt: new Date().toISOString()
    };
    db.payouts.push(created);
    return created;
}

function saveLocalLoanMovement(db, movement) {
    const employee = db.employees.find(item => item.id === movement.employeeId);
    const created = {
        ...movement,
        id: db.nextLoanMovementId++,
        type: movement.type === 'REPAYMENT' ? 'REPAYMENT' : 'LOAN',
        employeeName: employee?.name || '',
        createdAt: new Date().toISOString()
    };
    db.loanMovements.push(created);
    return created;
}

function completeLocalLine(db, line) {
    const service = db.services.find(item => item.id === line.serviceId);
    const employee = db.employees.find(item => item.id === line.employeeId);
    const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : 1;
    const unitPrice = Number(line.unitPrice) > 0 ? Number(line.unitPrice) : Number(service?.price || 0);
    const commissionPercent = Number(line.commissionPercent) >= 0 ? Number(line.commissionPercent) : Number(employee?.defaultCommissionPercent || 0);
    const lineTotal = quantity * unitPrice;
    return {
        ...line,
        serviceName: service?.name || '',
        employeeName: employee?.name || '',
        quantity,
        unitPrice,
        commissionPercent,
        lineTotal,
        employeeEarning: lineTotal * (commissionPercent / 100)
    };
}

function readLocalDb() {
    const stored = localStorage.getItem(localDbKey);
    if (stored) return normalizeLocalDb(JSON.parse(stored));
    const db = normalizeLocalDb({});
    writeLocalDb(db);
    return db;
}

function writeLocalDb(db) {
    localStorage.setItem(localDbKey, JSON.stringify(db));
}

function normalizeLocalDb(db) {
    db.employees ||= [];
    db.services ||= defaultServices();
    db.invoices ||= [];
    db.payouts ||= [];
    db.loanMovements ||= [];
    db.nextEmployeeId ||= nextId(db.employees);
    db.nextServiceId ||= nextId(db.services);
    db.nextInvoiceId ||= nextId(db.invoices);
    db.nextPayoutId ||= nextId(db.payouts);
    db.nextLoanMovementId ||= nextId(db.loanMovements);
    return db;
}

function defaultServices() {
    return [
        { id: 1, name: 'Lavado general', category: 'Autolavado', price: 25000, active: true },
        { id: 2, name: 'Monta llanta', category: 'Monta llantas', price: 12000, active: true },
        { id: 3, name: 'Revision mecanica', category: 'Mecanica', price: 40000, active: true }
    ];
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

async function loadData() {
    try {
        const summary = await api.get('/api/summary');
        state.employees = summary.employees || [];
        state.services = summary.services || [];
        state.invoices = summary.invoices || [];
        state.payouts = summary.payouts || [];
        state.loanMovements = summary.loanMovements || [];
        renderAll();
        if (state.invoiceLines.length === 0 && activeServices().length && activeEmployees().length) {
            addInvoiceLine();
        }
    } catch (error) {
        toast(error.message);
    }
}

function renderAll() {
    renderStats();
    renderEmployees();
    renderServices();
    renderEmployeeOptions();
    renderInvoiceLines();
    renderReports();
}

function renderStats() {
    const totalSales = state.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const commissions = state.invoices.reduce((sum, invoice) => sum + invoice.totalCommissions, 0);
    const paid = state.payouts.reduce((sum, payout) => sum + payout.amount, 0);
    document.getElementById('totalSales').textContent = money.format(totalSales);
    document.getElementById('totalCommissions').textContent = money.format(commissions);
    document.getElementById('businessNet').textContent = money.format(totalSales - commissions);
    document.getElementById('invoiceCount').textContent = `${state.invoices.length} / ${money.format(commissions - paid)} pend.`;
}

function renderEmployees() {
    const container = document.getElementById('employeeList');
    const employees = activeEmployees();
    container.innerHTML = employees.length ? employees.map(employee => `
        <article class="list-card">
            <div>
                <strong>${escapeHtml(employee.name)}</strong>
                <span>${escapeHtml(employee.phone || 'Sin telefono')} · ${employee.defaultCommissionPercent}% por servicio</span>
            </div>
            <div class="card-actions">
                <button class="ghost-button" type="button" onclick="editEmployee(${employee.id})">Editar</button>
                <button class="icon-button" type="button" title="Desactivar" onclick="removeEmployee(${employee.id})">x</button>
            </div>
        </article>
    `).join('') : emptyMessage('Aun no hay empleados activos.');
}

function renderServices() {
    const container = document.getElementById('serviceList');
    const services = activeServices();
    container.innerHTML = services.length ? services.map(service => `
        <article class="list-card">
            <div>
                <strong>${escapeHtml(service.name)}</strong>
                <span>${escapeHtml(service.category)} · ${money.format(service.price)}</span>
            </div>
            <div class="card-actions">
                <button class="ghost-button" type="button" onclick="editService(${service.id})">Editar</button>
                <button class="icon-button" type="button" title="Desactivar" onclick="removeService(${service.id})">x</button>
            </div>
        </article>
    `).join('') : emptyMessage('Aun no hay servicios activos.');
}

function renderEmployeeOptions() {
    const select = document.getElementById('loanEmployee');
    const options = activeEmployees().map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`).join('');
    select.innerHTML = options;
}

function renderInvoiceLines() {
    const body = document.getElementById('invoiceLines');
    body.innerHTML = state.invoiceLines.map((line, index) => invoiceLineTemplate(line, index)).join('');
    updateDraftTotals();
}

function invoiceLineTemplate(line, index) {
    const serviceOptions = activeServices().map(service => `
        <option value="${service.id}" ${Number(line.serviceId) === service.id ? 'selected' : ''}>
            ${escapeHtml(service.name)} - ${money.format(service.price)}
        </option>
    `).join('');
    const employeeOptions = activeEmployees().map(employee => `
        <option value="${employee.id}" ${Number(line.employeeId) === employee.id ? 'selected' : ''}>
            ${escapeHtml(employee.name)} (${employee.defaultCommissionPercent}%)
        </option>
    `).join('');

    return `
        <tr>
            <td><select onchange="setLine(${index}, 'serviceId', this.value)">${serviceOptions}</select></td>
            <td><select onchange="setLine(${index}, 'employeeId', this.value)">${employeeOptions}</select></td>
            <td><input type="number" min="1" value="${line.quantity}" onchange="setLine(${index}, 'quantity', this.value)"></td>
            <td><input type="number" min="0" step="100" value="${line.unitPrice}" onchange="setLine(${index}, 'unitPrice', this.value)"></td>
            <td><input type="number" min="0" max="100" step="0.1" value="${line.commissionPercent}" onchange="setLine(${index}, 'commissionPercent', this.value)"></td>
            <td><strong>${money.format(line.quantity * line.unitPrice)}</strong></td>
            <td><button class="icon-button" type="button" title="Quitar" onclick="removeLine(${index})">x</button></td>
        </tr>
    `;
}

function addInvoiceLine() {
    const service = activeServices()[0];
    const employee = activeEmployees()[0];
    if (!service || !employee) {
        toast('Crea al menos un empleado y un servicio activo.');
        return;
    }
    state.invoiceLines.push({
        serviceId: service.id,
        employeeId: employee.id,
        quantity: 1,
        unitPrice: service.price,
        commissionPercent: employee.defaultCommissionPercent
    });
    renderInvoiceLines();
}

function setLine(index, field, value) {
    const line = state.invoiceLines[index];
    line[field] = Number(value);
    if (field === 'serviceId') {
        const service = state.services.find(item => item.id === line.serviceId);
        if (service) line.unitPrice = service.price;
    }
    if (field === 'employeeId') {
        const employee = state.employees.find(item => item.id === line.employeeId);
        if (employee) line.commissionPercent = employee.defaultCommissionPercent;
    }
    renderInvoiceLines();
}

function removeLine(index) {
    state.invoiceLines.splice(index, 1);
    renderInvoiceLines();
}

function updateDraftTotals() {
    const total = state.invoiceLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const commission = state.invoiceLines.reduce((sum, line) => {
        return sum + (line.quantity * line.unitPrice * (line.commissionPercent / 100));
    }, 0);
    document.getElementById('draftTotal').textContent = money.format(total);
    document.getElementById('draftCommission').textContent = money.format(commission);
}

async function saveEmployee(event) {
    event.preventDefault();
    const id = Number(document.getElementById('employeeId').value);
    const employee = {
        name: document.getElementById('employeeName').value.trim(),
        phone: document.getElementById('employeePhone').value.trim(),
        defaultCommissionPercent: Number(document.getElementById('employeeCommission').value),
        active: true
    };
    await api.send(id ? `/api/employees/${id}` : '/api/employees', id ? 'PUT' : 'POST', employee);
    event.target.reset();
    document.getElementById('employeeId').value = '';
    toast('Empleado guardado.');
    await loadData();
}

async function saveService(event) {
    event.preventDefault();
    const id = Number(document.getElementById('serviceId').value);
    const service = {
        name: document.getElementById('serviceName').value.trim(),
        category: document.getElementById('serviceCategory').value,
        price: Number(document.getElementById('servicePrice').value),
        active: true
    };
    await api.send(id ? `/api/services/${id}` : '/api/services', id ? 'PUT' : 'POST', service);
    event.target.reset();
    document.getElementById('serviceId').value = '';
    toast('Servicio guardado.');
    await loadData();
}

async function saveInvoice(event) {
    event.preventDefault();
    if (state.invoiceLines.length === 0) {
        toast('Agrega al menos un servicio a la factura.');
        return;
    }
    const invoice = {
        customerName: document.getElementById('customerName').value.trim() || 'Cliente mostrador',
        vehiclePlate: document.getElementById('vehiclePlate').value.trim(),
        notes: document.getElementById('invoiceNotes').value.trim(),
        lines: state.invoiceLines.map(line => ({
            serviceId: Number(line.serviceId),
            employeeId: Number(line.employeeId),
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            commissionPercent: Number(line.commissionPercent)
        }))
    };
    await api.send('/api/invoices', 'POST', invoice);
    event.target.reset();
    state.invoiceLines = [];
    toast('Factura guardada.');
    await loadData();
}

async function saveLoanMovement(event) {
    event.preventDefault();
    const movement = {
        employeeId: Number(document.getElementById('loanEmployee').value),
        type: document.getElementById('loanType').value,
        amount: Number(document.getElementById('loanAmount').value),
        movementDate: document.getElementById('loanDate').value,
        notes: document.getElementById('loanNotes').value.trim()
    };
    await api.send('/api/loan-movements', 'POST', movement);
    event.target.reset();
    document.getElementById('loanDate').value = todayIso();
    toast(movement.type === 'LOAN' ? 'Prestamo registrado.' : 'Abono registrado.');
    await loadData();
}

async function payEmployeeDay(employeeId, amount) {
    if (amount <= 0) {
        toast('No hay saldo de comision para pagar.');
        return;
    }
    const period = getReportPeriod();
    const employee = state.employees.find(item => item.id === employeeId);
    const payout = {
        employeeId,
        workDate: period.anchor,
        amount,
        notes: `Pago de ${period.label.toLowerCase()} seleccionado`
    };
    await api.send('/api/payouts', 'POST', payout);
    toast(`Pago registrado para ${employee.name}.`);
    await loadData();
}

function editEmployee(id) {
    const employee = state.employees.find(item => item.id === id);
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeePhone').value = employee.phone || '';
    document.getElementById('employeeCommission').value = employee.defaultCommissionPercent;
}

async function removeEmployee(id) {
    await api.send(`/api/employees/${id}`, 'DELETE', {});
    toast('Empleado desactivado.');
    await loadData();
}

function editService(id) {
    const service = state.services.find(item => item.id === id);
    document.getElementById('serviceId').value = service.id;
    document.getElementById('serviceName').value = service.name;
    document.getElementById('serviceCategory').value = service.category;
    document.getElementById('servicePrice').value = service.price;
}

async function removeService(id) {
    await api.send(`/api/services/${id}`, 'DELETE', {});
    toast('Servicio desactivado.');
    await loadData();
}

function renderReports() {
    renderPayroll();
    renderLoanList();
    renderInvoiceHistory();
}

function renderPayroll() {
    const period = getReportPeriod();
    const rows = activeEmployees().map(employee => buildPayrollRow(employee, period));
    document.getElementById('payrollList').innerHTML = rows.length ? rows.map(row => `
        <article class="payroll-card ${row.balance <= 0 ? 'paid' : ''}">
            <header>
                <div>
                    <strong>${escapeHtml(row.employee.name)}</strong>
                    <span>${period.label}: ${period.text}</span>
                </div>
                <span class="status-pill">${row.balance <= 0 ? 'Pagado' : 'Pendiente'}</span>
            </header>
            <div class="payroll-grid">
                <span>Gano <strong>${money.format(row.earned)}</strong></span>
                <span>Pagado <strong>${money.format(row.paid)}</strong></span>
                <span>Debe pagarle <strong>${money.format(Math.max(row.balance, 0))}</strong></span>
                <span>Prestamos pendientes <strong>${money.format(row.loanDebt)}</strong></span>
            </div>
            <div class="card-actions">
                <button class="primary-button" type="button" onclick="payEmployeeDay(${row.employee.id}, ${Math.max(row.balance, 0)})">Marcar pago</button>
            </div>
        </article>
    `).join('') : emptyMessage('Registra empleados para ver la nomina.');
}

function buildPayrollRow(employee, period) {
    const earned = periodInvoices(period).reduce((sum, invoice) => {
        return sum + invoice.lines
            .filter(line => line.employeeId === employee.id)
            .reduce((lineSum, line) => lineSum + line.employeeEarning, 0);
    }, 0);
    const paid = state.payouts
        .filter(payout => payout.employeeId === employee.id && dateInPeriod(payout.workDate, period))
        .reduce((sum, payout) => sum + payout.amount, 0);
    return {
        employee,
        earned,
        paid,
        balance: earned - paid,
        loanDebt: employeeDebt(employee.id)
    };
}

function renderLoanList() {
    const debts = activeEmployees().map(employee => ({
        employee,
        debt: employeeDebt(employee.id),
        recent: state.loanMovements
            .filter(movement => movement.employeeId === employee.id)
            .sort((a, b) => new Date(b.movementDate) - new Date(a.movementDate))[0]
    }));
    document.getElementById('loanList').innerHTML = debts.length ? debts.map(row => `
        <article class="list-card">
            <div>
                <strong>${escapeHtml(row.employee.name)}</strong>
                <span>${row.recent ? `${movementLabel(row.recent)} el ${formatDateOnly(row.recent.movementDate)}` : 'Sin movimientos'}</span>
            </div>
            <strong class="${row.debt > 0 ? 'danger-text' : 'ok-text'}">${money.format(row.debt)}</strong>
        </article>
    `).join('') : emptyMessage('Registra empleados para llevar prestamos.');
}

function renderInvoiceHistory() {
    const period = getReportPeriod();
    const invoices = periodInvoices(period).sort((a, b) => b.id - a.id);
    document.getElementById('invoiceHistory').innerHTML = invoices.length ? invoices.map(invoice => `
        <article class="invoice-card">
            <header>
                <div>
                    <strong>Factura #${invoice.id} · ${escapeHtml(invoice.customerName)}</strong>
                    <span>${formatDate(invoice.createdAt)} · ${escapeHtml(invoice.vehiclePlate || 'Sin placa')}</span>
                </div>
                <strong>${money.format(invoice.total)}</strong>
            </header>
            <span>Comisiones: ${money.format(invoice.totalCommissions)} · Neto: ${money.format(invoice.businessNet)}</span>
            <ul>
                ${invoice.lines.map(line => `<li>${escapeHtml(line.serviceName)} con ${escapeHtml(line.employeeName)}: ${money.format(line.lineTotal)}</li>`).join('')}
            </ul>
        </article>
    `).join('') : emptyMessage('No hay facturas en este periodo.');
}

function periodInvoices(period) {
    return state.invoices.filter(invoice => dateInPeriod(dateOnly(invoice.createdAt), period));
}

function employeeDebt(employeeId) {
    return state.loanMovements
        .filter(movement => movement.employeeId === employeeId)
        .reduce((sum, movement) => {
            return sum + (movement.type === 'REPAYMENT' ? -movement.amount : movement.amount);
        }, 0);
}

function movementLabel(movement) {
    const label = movement.type === 'REPAYMENT' ? 'Abono' : 'Prestamo';
    return `${label}: ${money.format(movement.amount)}`;
}

function getReportPeriod() {
    const mode = document.getElementById('reportPeriod').value;
    const anchor = document.getElementById('reportDate').value || todayIso();
    const date = parseLocalDate(anchor);
    let start = new Date(date);
    let end = new Date(date);
    let label = 'Dia';

    if (mode === 'week') {
        const day = date.getDay() || 7;
        start.setDate(date.getDate() - day + 1);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        label = 'Semana';
    }
    if (mode === 'month') {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        label = 'Mes';
    }

    return {
        mode,
        anchor,
        label,
        start: toIsoDate(start),
        end: toIsoDate(end),
        text: toIsoDate(start) === toIsoDate(end) ? formatDateOnly(toIsoDate(start)) : `${formatDateOnly(toIsoDate(start))} a ${formatDateOnly(toIsoDate(end))}`
    };
}

function dateInPeriod(value, period) {
    const date = dateOnly(value);
    return date >= period.start && date <= period.end;
}

function activeEmployees() {
    return state.employees.filter(employee => employee.active);
}

function activeServices() {
    return state.services.filter(service => service.active);
}

function emptyMessage(text) {
    return `<article class="list-card"><span>${text}</span></article>`;
}

function dateOnly(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateOnly(value) {
    if (!value) return '';
    return parseLocalDate(value).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

function todayIso() {
    return toIsoDate(new Date());
}

function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
}

function toast(message) {
    const box = document.getElementById('toast');
    box.textContent = message;
    box.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => box.classList.remove('show'), 2600);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[character]));
}

window.editEmployee = editEmployee;
window.removeEmployee = removeEmployee;
window.editService = editService;
window.removeService = removeService;
window.setLine = setLine;
window.removeLine = removeLine;
window.payEmployeeDay = payEmployeeDay;
