/**
 * Limpia los nombres de productos para evitar redundancias entre Familia, Variante y SKU.
 * Ejemplo: "Cloro - Cloro Macier - Macier - Galon" -> "Cloro - Macier - Galon"
 */
export const cleanProductName = (name) => {
    if (!name || typeof name !== 'string') return name || '';
    if (!name.includes(" - ")) return name;

    const parts = name.split(" - ").map(p => p.trim());
    const uniqueParts = [];

    parts.forEach(p => {
        if (!p) return;
        // Solo eliminamos si es un duplicado exacto o muy obvio (mismo inicio de palabra)
        // para evitar borrar marcas que se parecen a la familia.
        const isDuplicate = uniqueParts.some(up => 
            up.toLowerCase() === p.toLowerCase()
        );

        if (!isDuplicate) {
            uniqueParts.push(p);
        }
    });

    return uniqueParts.join(" - ");
};

/**
 * Versión más relajada para el buscador que solo quita duplicados exactos.
 */
export const cleanProductNameSoft = (name) => {
    if (!name || typeof name !== 'string') return name || '';
    if (!name.includes(" - ")) return name;
    const parts = name.split(" - ").map(p => p.trim());
    return [...new Set(parts)].join(" - ");
};
