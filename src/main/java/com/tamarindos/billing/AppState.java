package com.tamarindos.billing;

import java.util.ArrayList;
import java.util.List;

public class AppState {
    public List<Employee> employees = new ArrayList<>();
    public List<ServiceItem> services = new ArrayList<>();
    public List<Invoice> invoices = new ArrayList<>();
    public List<EmployeePayout> payouts = new ArrayList<>();
    public List<LoanMovement> loanMovements = new ArrayList<>();
    public long nextEmployeeId = 1;
    public long nextServiceId = 1;
    public long nextInvoiceId = 1;
    public long nextPayoutId = 1;
    public long nextLoanMovementId = 1;
}
