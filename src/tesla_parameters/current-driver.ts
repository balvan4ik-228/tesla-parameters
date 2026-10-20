// Авторизации до ЛР4 нет: пользователи зафиксированы константами,
// доступ к ним — через функции-синглтоны.

const CREATOR_ID = 1; // Иван Петров, обычный водитель
const MODERATOR_ID = 3; // Инженер сервисного центра, модератор

// Текущий создатель заявок
export const getCurrentDriverId = (): number => CREATOR_ID;

// Текущий модератор
export const getCurrentModeratorId = (): number => MODERATOR_ID;

// Прежние имена констант сохранены: их использует код лабораторных 1 и 2
export const CURRENT_DRIVER_ID = getCurrentDriverId();
export const CURRENT_MODERATOR_ID = getCurrentModeratorId();
