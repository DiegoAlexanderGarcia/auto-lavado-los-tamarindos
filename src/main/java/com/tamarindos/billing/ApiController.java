package com.tamarindos.billing;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final DataStore store;

    public ApiController(DataStore store) {
        this.store = store;
    }

    @GetMapping("/summary")
    public AppState summary() {
        return store.snapshot();
    }

    @GetMapping("/employees")
    public List<Employee> employees() {
        return store.employees();
    }

    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)
    public Employee createEmployee(@RequestBody Employee employee) {
        return store.saveEmployee(employee);
    }

    @PutMapping("/employees/{id}")
    public Employee updateEmployee(@PathVariable long id, @RequestBody Employee employee) {
        employee.id = id;
        return store.saveEmployee(employee);
    }

    @DeleteMapping("/employees/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEmployee(@PathVariable long id) {
        store.deleteEmployee(id);
    }

    @GetMapping("/services")
    public List<ServiceItem> services() {
        return store.services();
    }

    @PostMapping("/services")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceItem createService(@RequestBody ServiceItem service) {
        return store.saveService(service);
    }

    @PutMapping("/services/{id}")
    public ServiceItem updateService(@PathVariable long id, @RequestBody ServiceItem service) {
        service.id = id;
        return store.saveService(service);
    }

    @DeleteMapping("/services/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteService(@PathVariable long id) {
        store.deleteService(id);
    }

    @GetMapping("/invoices")
    public List<Invoice> invoices() {
        return store.invoices();
    }

    @PostMapping("/invoices")
    @ResponseStatus(HttpStatus.CREATED)
    public Invoice createInvoice(@RequestBody Invoice invoice) {
        return store.saveInvoice(invoice);
    }

    @GetMapping("/payouts")
    public List<EmployeePayout> payouts() {
        return store.payouts();
    }

    @PostMapping("/payouts")
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeePayout createPayout(@RequestBody EmployeePayout payout) {
        return store.savePayout(payout);
    }

    @GetMapping("/loan-movements")
    public List<LoanMovement> loanMovements() {
        return store.loanMovements();
    }

    @PostMapping("/loan-movements")
    @ResponseStatus(HttpStatus.CREATED)
    public LoanMovement createLoanMovement(@RequestBody LoanMovement movement) {
        return store.saveLoanMovement(movement);
    }
}
