package com.tamarindos.billing;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Invoice {
    public long id;
    public String customerName;
    public String vehiclePlate;
    public String notes;
    public LocalDateTime createdAt;
    public List<InvoiceLine> lines = new ArrayList<>();
    public double total;
    public double totalCommissions;
    public double businessNet;
}
