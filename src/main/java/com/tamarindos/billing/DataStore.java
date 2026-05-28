package com.tamarindos.billing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class DataStore {
    private final ObjectMapper mapper;
    private final Path dataFile;
    private AppState state;

    public DataStore(@Value("${tamarindos.data-file}") String dataFile) {
        this.dataFile = Path.of(dataFile);
        this.mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .enable(SerializationFeature.INDENT_OUTPUT);
        this.state = load();
        normalizeState();
        seedDefaultsIfEmpty();
    }

    public synchronized AppState snapshot() {
        return state;
    }

    public synchronized Employee saveEmployee(Employee employee) {
        if (employee.id == 0) {
            employee.id = state.nextEmployeeId++;
            state.employees.add(employee);
        } else {
            Employee current = findEmployee(employee.id).orElseThrow();
            current.name = employee.name;
            current.phone = employee.phone;
            current.defaultCommissionPercent = employee.defaultCommissionPercent;
            current.active = employee.active;
            employee = current;
        }
        persist();
        return employee;
    }

    public synchronized ServiceItem saveService(ServiceItem service) {
        if (service.id == 0) {
            service.id = state.nextServiceId++;
            state.services.add(service);
        } else {
            ServiceItem current = findService(service.id).orElseThrow();
            current.name = service.name;
            current.category = service.category;
            current.price = service.price;
            current.active = service.active;
            service = current;
        }
        persist();
        return service;
    }

    public synchronized Invoice saveInvoice(Invoice invoice) {
        invoice.id = state.nextInvoiceId++;
        invoice.createdAt = java.time.LocalDateTime.now();
        invoice.lines.forEach(this::completeLine);
        invoice.total = invoice.lines.stream().mapToDouble(line -> line.lineTotal).sum();
        invoice.totalCommissions = invoice.lines.stream().mapToDouble(line -> line.employeeEarning).sum();
        invoice.businessNet = invoice.total - invoice.totalCommissions;
        state.invoices.add(invoice);
        persist();
        return invoice;
    }

    public synchronized EmployeePayout savePayout(EmployeePayout payout) {
        Employee employee = findEmployee(payout.employeeId).orElseThrow();
        payout.id = state.nextPayoutId++;
        payout.employeeName = employee.name;
        payout.createdAt = java.time.LocalDateTime.now();
        state.payouts.add(payout);
        persist();
        return payout;
    }

    public synchronized LoanMovement saveLoanMovement(LoanMovement movement) {
        Employee employee = findEmployee(movement.employeeId).orElseThrow();
        movement.id = state.nextLoanMovementId++;
        movement.employeeName = employee.name;
        movement.createdAt = java.time.LocalDateTime.now();
        if (!"REPAYMENT".equals(movement.type)) {
            movement.type = "LOAN";
        }
        state.loanMovements.add(movement);
        persist();
        return movement;
    }

    public synchronized List<Employee> employees() {
        return state.employees;
    }

    public synchronized List<ServiceItem> services() {
        return state.services;
    }

    public synchronized List<Invoice> invoices() {
        return state.invoices;
    }

    public synchronized List<EmployeePayout> payouts() {
        return state.payouts;
    }

    public synchronized List<LoanMovement> loanMovements() {
        return state.loanMovements;
    }

    public synchronized void deleteEmployee(long id) {
        findEmployee(id).ifPresent(employee -> employee.active = false);
        persist();
    }

    public synchronized void deleteService(long id) {
        findService(id).ifPresent(service -> service.active = false);
        persist();
    }

    private Optional<Employee> findEmployee(long id) {
        return state.employees.stream().filter(employee -> employee.id == id).findFirst();
    }

    private Optional<ServiceItem> findService(long id) {
        return state.services.stream().filter(service -> service.id == id).findFirst();
    }

    private void completeLine(InvoiceLine line) {
        ServiceItem service = findService(line.serviceId).orElseThrow();
        Employee employee = findEmployee(line.employeeId).orElseThrow();
        if (line.quantity <= 0) {
            line.quantity = 1;
        }
        line.serviceName = service.name;
        line.employeeName = employee.name;
        line.unitPrice = line.unitPrice > 0 ? line.unitPrice : service.price;
        line.commissionPercent = line.commissionPercent >= 0 ? line.commissionPercent : employee.defaultCommissionPercent;
        line.lineTotal = line.quantity * line.unitPrice;
        line.employeeEarning = line.lineTotal * (line.commissionPercent / 100);
    }

    private AppState load() {
        if (!Files.exists(dataFile)) {
            return new AppState();
        }
        try {
            return mapper.readValue(dataFile.toFile(), AppState.class);
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo cargar el archivo de datos: " + dataFile, ex);
        }
    }

    private void normalizeState() {
        if (state.employees == null) {
            state.employees = new ArrayList<>();
        }
        if (state.services == null) {
            state.services = new ArrayList<>();
        }
        if (state.invoices == null) {
            state.invoices = new ArrayList<>();
        }
        if (state.payouts == null) {
            state.payouts = new ArrayList<>();
        }
        if (state.loanMovements == null) {
            state.loanMovements = new ArrayList<>();
        }
        state.nextEmployeeId = Math.max(state.nextEmployeeId, state.employees.stream().mapToLong(employee -> employee.id).max().orElse(0) + 1);
        state.nextServiceId = Math.max(state.nextServiceId, state.services.stream().mapToLong(service -> service.id).max().orElse(0) + 1);
        state.nextInvoiceId = Math.max(state.nextInvoiceId, state.invoices.stream().mapToLong(invoice -> invoice.id).max().orElse(0) + 1);
        state.nextPayoutId = Math.max(state.nextPayoutId, state.payouts.stream().mapToLong(payout -> payout.id).max().orElse(0) + 1);
        state.nextLoanMovementId = Math.max(state.nextLoanMovementId, state.loanMovements.stream().mapToLong(movement -> movement.id).max().orElse(0) + 1);
    }

    private void persist() {
        try {
            Files.createDirectories(dataFile.getParent());
            mapper.writeValue(dataFile.toFile(), state);
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo guardar el archivo de datos: " + dataFile, ex);
        }
    }

    private void seedDefaultsIfEmpty() {
        if (!state.services.isEmpty()) {
            return;
        }
        ServiceItem lavado = new ServiceItem();
        lavado.id = state.nextServiceId++;
        lavado.name = "Lavado general";
        lavado.category = "Autolavado";
        lavado.price = 25000;

        ServiceItem montaLlanta = new ServiceItem();
        montaLlanta.id = state.nextServiceId++;
        montaLlanta.name = "Monta llanta";
        montaLlanta.category = "Monta llantas";
        montaLlanta.price = 12000;

        ServiceItem revision = new ServiceItem();
        revision.id = state.nextServiceId++;
        revision.name = "Revision mecanica";
        revision.category = "Mecanica";
        revision.price = 40000;

        state.services.add(lavado);
        state.services.add(montaLlanta);
        state.services.add(revision);
        persist();
    }
}
