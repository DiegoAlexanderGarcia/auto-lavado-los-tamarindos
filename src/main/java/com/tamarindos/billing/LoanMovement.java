package com.tamarindos.billing;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class LoanMovement {
    public long id;
    public long employeeId;
    public String employeeName;
    public LocalDate movementDate;
    public String type;
    public double amount;
    public String notes;
    public LocalDateTime createdAt;
}
