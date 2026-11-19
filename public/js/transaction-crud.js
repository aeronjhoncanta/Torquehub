/**
 * Transaction Management CRUD Interface
 * Enhanced jQuery/DataTables implementation for TorqueHub
 */

class TransactionManager {
    constructor() {
        this.transactionsTable = null;
        this.products = [];
        this.currentUser = null;
        this.selectedTransactions = [];
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.initializeDataTable();
        this.loadStats();
        this.loadProducts();
        this.setupEventListeners();
    }

    checkAuth() {
        $.get('/api/profile')
            .done((user) => {
                this.currentUser = user;
                        // Removed admin check - all authenticated users can access this page
            })
            .fail(() => {
                window.location.href = '/login';
            });
    }

    initializeDataTable() {
        this.transactionsTable = $('#transactionsTable').DataTable({
            ajax: {
                url: '/api/transactions',
                dataSrc: ''
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    render: (data, type, row) => {
                        return `<input type="checkbox" class="row-checkbox" value="${row.id}">`;
                    }
                },
                { data: 'id' },
                { data: 'User.full_name' },
                { data: 'Product.name' },
                { data: 'quantity' },
                { 
                    data: 'total_amount',
                    render: (data) => {
                        return '$' + parseFloat(data).toFixed(2);
                    }
                },
                { 
                    data: 'status',
                    render: (data) => {
                        return `<span class="status-badge status-${data}">${data.charAt(0).toUpperCase() + data.slice(1)}</span>`;
                    }
                },
                { data: 'payment_method' },
                { 
                    data: 'createdAt',
                    render: (data) => {
                        return new Date(data).toLocaleDateString();
                    }
                },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    render: (data, type, row) => {
                        return `
                            <div class="action-buttons">
                                <button class="btn-transaction btn-sm" onclick="transactionManager.viewTransaction(${row.id})" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-transaction btn-sm btn-success" onclick="transactionManager.editTransaction(${row.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-transaction btn-sm btn-danger" onclick="transactionManager.deleteTransaction(${row.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'csv', 'excel', 'pdf', 'print'
            ],
            order: [[1, 'desc']],
            pageLength: 25,
            select: {
                style: 'multi',
                selector: 'td:first-child input[type="checkbox"]'
            },
            language: {
                search: "Search transactions:",
                lengthMenu: "Show _MENU_ transactions per page",
                info: "Showing _START_ to _END_ of _TOTAL_ transactions",
                paginate: {
                    first: "First",
                    last: "Last",
                    next: "Next",
                    previous: "Previous"
                }
            }
        });
    }

    setupEventListeners() {
        // Select all checkbox
        $('#selectAll').change((e) => {
            const isChecked = $(e.target).is(':checked');
            $('.row-checkbox').prop('checked', isChecked);
            this.updateSelectedCount();
        });

        // Individual row checkboxes
        $(document).on('change', '.row-checkbox', () => {
            this.updateSelectedCount();
            this.updateSelectAllState();
        });

        // Form submission
        $('#transactionForm').submit((e) => {
            e.preventDefault();
            this.submitTransaction();
        });

        // Product selection change
        $('#productSelect').change(() => {
            this.updateTotalAmount();
        });

        // Quantity change
        $('#quantity').change(() => {
            this.updateTotalAmount();
        });

        // Close modals when clicking outside
        $(window).click((event) => {
            if (event.target.className === 'modal') {
                $('.modal').hide();
            }
        });
    }

    updateSelectedCount() {
        const selectedCount = $('.row-checkbox:checked').length;
        $('#selectedCount').text(selectedCount);
    }

    updateSelectAllState() {
        const totalCheckboxes = $('.row-checkbox').length;
        const checkedCheckboxes = $('.row-checkbox:checked').length;
        
        if (checkedCheckboxes === 0) {
            $('#selectAll').prop('indeterminate', false).prop('checked', false);
        } else if (checkedCheckboxes === totalCheckboxes) {
            $('#selectAll').prop('indeterminate', false).prop('checked', true);
        } else {
            $('#selectAll').prop('indeterminate', true);
        }
    }

    updateTotalAmount() {
        const productId = $('#productSelect').val();
        const quantity = parseInt($('#quantity').val()) || 0;
        
        if (productId && quantity > 0) {
            const product = this.products.find(p => p.id == productId);
            if (product) {
                const total = parseFloat(product.price) * quantity;
                // You could display this in a total field if needed
            }
        }
    }

    loadStats() {
        $.get('/api/transactions/stats/overview')
            .done((stats) => {
                $('#totalTransactions').text(stats.total);
                $('#pendingTransactions').text(stats.pending);
                $('#completedTransactions').text(stats.completed);
                $('#totalRevenue').text('$' + parseFloat(stats.revenue || 0).toFixed(2));
            })
            .fail(() => {
                this.showMessage('Failed to load statistics', 'error');
            });
    }

    loadProducts() {
        $.get('/api/products')
            .done((data) => {
                this.products = data;
                const select = $('#productSelect');
                select.empty();
                select.append('<option value="">Select a product</option>');
                
                data.forEach(product => {
                    select.append(`<option value="${product.id}" data-price="${product.price}">${product.name} - $${product.price}</option>`);
                });
            })
            .fail(() => {
                this.showMessage('Failed to load products', 'error');
            });
    }

    openCreateModal() {
        $('#modalTitle').text('Create Transaction');
        $('#transactionForm')[0].reset();
        $('#transactionId').val('');
        $('#statusGroup').hide();
        $('#transactionModal').show();
    }

    editTransaction(id) {
        this.showLoading(true);
        $.get(`/api/transactions/${id}`)
            .done((transaction) => {
                $('#modalTitle').text('Edit Transaction');
                $('#transactionId').val(transaction.id);
                $('#productSelect').val(transaction.product_id);
                $('#quantity').val(transaction.quantity);
                $('#paymentMethod').val(transaction.payment_method);
                $('#shippingAddress').val(transaction.shipping_address);
                $('#notes').val(transaction.notes);
                $('#status').val(transaction.status);
                $('#statusGroup').show();
                $('#transactionModal').show();
            })
            .fail(() => {
                this.showMessage('Failed to load transaction', 'error');
            })
            .always(() => {
                this.showLoading(false);
            });
    }

    viewTransaction(id) {
        this.showLoading(true);
        $.get(`/api/transactions/${id}`)
            .done((transaction) => {
                const details = `
                    <div class="transaction-details">
                        <h4>Transaction Information</h4>
                        <p><strong>Transaction ID:</strong> #${transaction.id}</p>
                        <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${transaction.status}">${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}</span></p>
                    </div>
                    
                    <div class="transaction-details">
                        <h4>Customer Information</h4>
                        <p><strong>Name:</strong> ${transaction.User.full_name}</p>
                        <p><strong>Email:</strong> ${transaction.User.email}</p>
                    </div>
                    
                    <div class="transaction-details">
                        <h4>Product Information</h4>
                        <p><strong>Product:</strong> ${transaction.Product.name}</p>
                        <p><strong>Price:</strong> $${transaction.Product.price}</p>
                        <p><strong>Quantity:</strong> ${transaction.quantity}</p>
                        <p><strong>Total Amount:</strong> $${parseFloat(transaction.total_amount).toFixed(2)}</p>
                    </div>
                    
                    <div class="transaction-details">
                        <h4>Payment & Shipping</h4>
                        <p><strong>Payment Method:</strong> ${transaction.payment_method || 'Not specified'}</p>
                        <p><strong>Shipping Address:</strong> ${transaction.shipping_address || 'Not specified'}</p>
                    </div>
                    
                    ${transaction.notes ? `<div class="transaction-details"><h4>Notes</h4><p>${transaction.notes}</p></div>` : ''}
                `;
                
                $('#transactionDetails').html(details);
                $('#viewModal').show();
            })
            .fail(() => {
                this.showMessage('Failed to load transaction details', 'error');
            })
            .always(() => {
                this.showLoading(false);
            });
    }

    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
            this.showLoading(true);
            $.ajax({
                url: `/api/transactions/${id}`,
                method: 'DELETE'
            })
            .done(() => {
                this.showMessage('Transaction deleted successfully', 'success');
                this.transactionsTable.ajax.reload();
                this.loadStats();
            })
            .fail(() => {
                this.showMessage('Failed to delete transaction', 'error');
            })
            .always(() => {
                this.showLoading(false);
            });
        }
    }

    submitTransaction() {
        const transactionId = $('#transactionId').val();
        const data = {
            product_id: $('#productSelect').val(),
            quantity: $('#quantity').val(),
            payment_method: $('#paymentMethod').val(),
            shipping_address: $('#shippingAddress').val(),
            notes: $('#notes').val()
        };
        
        if (transactionId) {
            data.status = $('#status').val();
        }
        
        this.showLoading(true);
        
        const url = transactionId ? `/api/transactions/${transactionId}` : '/api/transactions';
        const method = transactionId ? 'PUT' : 'POST';
        
        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(data)
        })
        .done(() => {
            this.showMessage(transactionId ? 'Transaction updated successfully' : 'Transaction created successfully', 'success');
            this.closeModal();
            this.transactionsTable.ajax.reload();
            this.loadStats();
        })
        .fail((xhr) => {
            const error = xhr.responseJSON?.error || 'Failed to save transaction';
            this.showMessage(error, 'error');
        })
        .always(() => {
            this.showLoading(false);
        });
    }

    bulkUpdateStatus() {
        const selectedIds = this.getSelectedTransactionIds();
        if (selectedIds.length === 0) {
            this.showMessage('Please select at least one transaction', 'error');
            return;
        }
        
        $('#selectedCount').text(selectedIds.length);
        $('#bulkStatusModal').show();
    }

    confirmBulkUpdate() {
        const status = $('#bulkStatus').val();
        const selectedIds = this.getSelectedTransactionIds();
        
        if (!status) {
            this.showMessage('Please select a status', 'error');
            return;
        }
        
        this.showLoading(true);
        
        const promises = selectedIds.map(id => 
            $.ajax({
                url: `/api/transactions/${id}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify({ status: status })
            })
        );
        
        Promise.all(promises)
            .then(() => {
                this.showMessage(`Updated status for ${selectedIds.length} transactions`, 'success');
                this.closeBulkModal();
                this.transactionsTable.ajax.reload();
                this.loadStats();
                this.clearSelection();
            })
            .catch(() => {
                this.showMessage('Failed to update some transactions', 'error');
            })
            .always(() => {
                this.showLoading(false);
            });
    }

    bulkDelete() {
        const selectedIds = this.getSelectedTransactionIds();
        if (selectedIds.length === 0) {
            this.showMessage('Please select at least one transaction', 'error');
            return;
        }
        
        if (confirm(`Are you sure you want to delete ${selectedIds.length} transactions? This action cannot be undone.`)) {
            this.showLoading(true);
            
            const promises = selectedIds.map(id => 
                $.ajax({
                    url: `/api/transactions/${id}`,
                    method: 'DELETE'
                })
            );
            
            Promise.all(promises)
                .then(() => {
                    this.showMessage(`Deleted ${selectedIds.length} transactions`, 'success');
                    this.transactionsTable.ajax.reload();
                    this.loadStats();
                    this.clearSelection();
                })
                .catch(() => {
                    this.showMessage('Failed to delete some transactions', 'error');
                })
                .always(() => {
                    this.showLoading(false);
                });
        }
    }

    getSelectedTransactionIds() {
        return $('.row-checkbox:checked').map(function() {
            return $(this).val();
        }).get();
    }

    clearSelection() {
        $('.row-checkbox').prop('checked', false);
        $('#selectAll').prop('checked', false).prop('indeterminate', false);
        this.updateSelectedCount();
    }

    exportData(type) {
        const button = this.transactionsTable.button(`buttons-${type}`);
        button.trigger();
    }

    showLoading(show) {
        if (show) {
            $('#submitText').hide();
            $('#submitLoading').show();
            $('#submitBtn').prop('disabled', true);
        } else {
            $('#submitText').show();
            $('#submitLoading').hide();
            $('#submitBtn').prop('disabled', false);
        }
    }

    closeModal() {
        $('#transactionModal').hide();
        this.showLoading(false);
    }

    closeViewModal() {
        $('#viewModal').hide();
    }

    closeBulkModal() {
        $('#bulkStatusModal').hide();
        $('#bulkStatus').val('');
    }

    showMessage(message, type) {
        const container = $('#messageContainer');
        const alertClass = type === 'error' ? 'error-message' : 'success-message';
        
        container.html(`<div class="${alertClass}">${message}</div>`);
        
        setTimeout(() => {
            container.empty();
        }, 5000);
    }
}

// Global functions for HTML onclick handlers
function openCreateModal() {
    transactionManager.openCreateModal();
}

function editTransaction(id) {
    transactionManager.editTransaction(id);
}

function viewTransaction(id) {
    transactionManager.viewTransaction(id);
}

function deleteTransaction(id) {
    transactionManager.deleteTransaction(id);
}

function bulkUpdateStatus() {
    transactionManager.bulkUpdateStatus();
}

function confirmBulkUpdate() {
    transactionManager.confirmBulkUpdate();
}

function bulkDelete() {
    transactionManager.bulkDelete();
}

function exportData(type) {
    transactionManager.exportData(type);
}

function closeModal() {
    transactionManager.closeModal();
}

function closeViewModal() {
    transactionManager.closeViewModal();
}

function closeBulkModal() {
    transactionManager.closeBulkModal();
}

// Initialize when document is ready
let transactionManager;

$(document).ready(function() {
    transactionManager = new TransactionManager();
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to logout?')) {
                return;
            }
            
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    alert('Logged out successfully');
                    window.location.href = '/';
                } else {
                    throw new Error('Logout failed');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('Logout failed. Please try again.');
            }
        });
    }
}); 