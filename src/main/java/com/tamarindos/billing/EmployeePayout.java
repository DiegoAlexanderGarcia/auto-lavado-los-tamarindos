package com.tamarindos.billing;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class EmployeePayout {
    public long id;
    public long employeeId;
    public String employeeName;
    public LocalDate workDate;
    public double amount;
    public String notes;
    public LocalDateTime createdAt;
}
