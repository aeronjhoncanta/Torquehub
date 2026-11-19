// Custom jQuery Pagination System
class CustomPagination {
    constructor(container, options = {}) {
        this.container = $(container);
        this.options = {
            itemsPerPage: options.itemsPerPage || 10,
            currentPage: options.currentPage || 1,
            totalItems: options.totalItems || 0,
            onPageChange: options.onPageChange || function() {},
            ...options
        };
        
        this.currentPage = this.options.currentPage;
        this.totalPages = Math.ceil(this.options.totalItems / this.options.itemsPerPage);
        
        this.init();
    }
    
    init() {
        this.renderPagination();
        this.bindEvents();
    }
    
    renderPagination() {
        const paginationHtml = this.generatePaginationHTML();
        this.container.html(paginationHtml);
    }
    
    generatePaginationHTML() {
        if (this.totalPages <= 1) return '';
        
        let html = '<div class="custom-pagination">';
        html += '<div class="pagination-info">';
        html += `<span>Showing ${this.getStartIndex() + 1} to ${this.getEndIndex()} of ${this.options.totalItems} items</span>`;
        html += '</div>';
        
        html += '<div class="pagination-controls">';
        
        // Previous button
        if (this.currentPage > 1) {
            html += `<button class="pagination-btn prev-btn" data-page="${this.currentPage - 1}">
                        <i class="fas fa-chevron-left"></i> Previous
                     </button>`;
        }
        
        // Page numbers
        html += '<div class="page-numbers">';
        
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            html += `<button class="pagination-btn page-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            html += `<button class="pagination-btn page-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                html += '<span class="pagination-ellipsis">...</span>';
            }
            html += `<button class="pagination-btn page-btn" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }
        
        html += '</div>';
        
        // Next button
        if (this.currentPage < this.totalPages) {
            html += `<button class="pagination-btn next-btn" data-page="${this.currentPage + 1}">
                        Next <i class="fas fa-chevron-right"></i>
                     </button>`;
        }
        
        html += '</div>';
        html += '</div>';
        
        return html;
    }
    
    bindEvents() {
        this.container.on('click', '.pagination-btn', (e) => {
            e.preventDefault();
            const page = parseInt($(e.currentTarget).data('page'));
            if (page && page !== this.currentPage) {
                this.goToPage(page);
            }
        });
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        this.renderPagination();
        this.options.onPageChange(this.currentPage, this.getStartIndex(), this.getEndIndex());
        
        // Update URL without page reload
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
    }
    
    getStartIndex() {
        return (this.currentPage - 1) * this.options.itemsPerPage;
    }
    
    getEndIndex() {
        return Math.min(this.currentPage * this.options.itemsPerPage, this.options.totalItems);
    }
    
    updateTotalItems(totalItems) {
        this.options.totalItems = totalItems;
        this.totalPages = Math.ceil(totalItems / this.options.itemsPerPage);
        this.renderPagination();
    }
    
    getCurrentPage() {
        return this.currentPage;
    }
    
    getItemsPerPage() {
        return this.options.itemsPerPage;
    }
}

// Custom Infinite Scroll System
class CustomInfiniteScroll {
    constructor(container, options = {}) {
        this.container = $(container);
        this.options = {
            itemsPerLoad: options.itemsPerLoad || 10,
            threshold: options.threshold || 100, // pixels from bottom
            loadingHtml: options.loadingHtml || '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>',
            onLoadMore: options.onLoadMore || function() {},
            ...options
        };
        
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreData = true;
        
        this.init();
    }
    
    init() {
        this.bindScrollEvent();
        this.renderLoadingIndicator();
    }
    
    bindScrollEvent() {
        $(window).on('scroll', () => {
            if (this.isLoading || !this.hasMoreData) return;
            
            const scrollTop = $(window).scrollTop();
            const windowHeight = $(window).height();
            const documentHeight = $(document).height();
            
            if (scrollTop + windowHeight >= documentHeight - this.options.threshold) {
                this.loadMore();
            }
        });
    }
    
    renderLoadingIndicator() {
        this.loadingIndicator = $(this.options.loadingHtml);
        this.loadingIndicator.hide();
        this.container.append(this.loadingIndicator);
    }
    
    loadMore() {
        if (this.isLoading || !this.hasMoreData) return;
        
        this.isLoading = true;
        this.loadingIndicator.show();
        
        this.currentPage++;
        
        this.options.onLoadMore(this.currentPage, this.options.itemsPerLoad, (hasMore) => {
            this.isLoading = false;
            this.loadingIndicator.hide();
            this.hasMoreData = hasMore;
        });
    }
    
    reset() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreData = true;
        this.loadingIndicator.hide();
    }
    
    setHasMoreData(hasMore) {
        this.hasMoreData = hasMore;
        if (!hasMore) {
            this.loadingIndicator.hide();
        }
    }
} 