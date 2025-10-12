const { 
  parse, format, addDays, differenceInDays, 
  isBefore, isAfter, startOfDay, endOfDay,
  parseISO
} = require('date-fns');
const { es } = require('date-fns/locale');

/**
 * Servicio centralizado para manejo de fechas
 */
class DateService {
  /**
   * Convierte string en formato YYYY-MM-DD a objeto Date
   * @param {string} dateString - Fecha en formato YYYY-MM-DD
   * @return {Date} Objeto Date normalizado a 00:00:00
   */
  static parseDate(dateString) {
    if (!dateString) return null;
    // Usar parseISO para ISO strings o parse para formatos específicos
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString) 
      ? parse(dateString, 'yyyy-MM-dd', new Date())
      : parseISO(dateString);
    return startOfDay(date); // Normalizar a 00:00:00
  }

  /**
   * Convierte Date a string YYYY-MM-DD
   */
  static formatDate(date) {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Formatea fecha para mostrar en UI
   */
  static formatDateUI(date, showYear = true) {
    if (!date) return '';
    return format(date, showYear ? 'dd/MM/yyyy' : 'dd/MM', { locale: es });
  }

  /**
   * Calcula diferencia entre fechas en días
   */
  static daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    return differenceInDays(endDate, startDate);
  }

  /**
   * Verifica si dos rangos de fechas se solapan
   */
  static datesOverlap(start1, end1, start2, end2) {
    const s1 = this.parseDate(start1);
    const e1 = this.parseDate(end1);
    const s2 = this.parseDate(start2);
    const e2 = this.parseDate(end2);
    
    // Verificar solapamiento
    return (isBefore(s1, e2) && isAfter(e1, s2));
  }

  /**
   * Obtiene la fecha actual normalizada a 00:00:00
   */
  static today() {
    return startOfDay(new Date());
  }
  
  /**
   * Añade días a una fecha
   */
  static addDays(date, days) {
    return addDays(date, days);
  }
}

module.exports = DateService;