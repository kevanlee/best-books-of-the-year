(function () {
  function createSupabaseClient() {
    if (!window.supabaseClient || typeof window.supabaseClient.from !== "function") {
      return null;
    }

    async function select(table, options) {
      let query = window.supabaseClient.from(table).select(options.select || "*");

      (options.filters || []).forEach((filter) => {
        if (!filter || !filter.column || !filter.operator) {
          return;
        }

        if (filter.operator === "in") {
          const values = Array.isArray(filter.value) ? filter.value.filter(Boolean) : [];
          if (!values.length) {
            return;
          }
          query = query.in(filter.column, values);
          return;
        }

        if (filter.value === undefined || filter.value === null || filter.value === "") {
          return;
        }

        if (filter.operator === "eq") {
          query = query.eq(filter.column, filter.value);
        }
      });

      if (options.order && options.order.column) {
        query = query.order(options.order.column, { ascending: Boolean(options.order.ascending) });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Supabase query failed for ${table}: ${error.message}`);
      }

      return data || [];
    }

    return {
      select
    };
  }

  function getConfiguredClient() {
    return createSupabaseClient();
  }

  window.BOOKLIST_SUPABASE = {
    createSupabaseClient,
    getConfiguredClient
  };
})();
