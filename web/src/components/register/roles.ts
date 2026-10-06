export type RegistrableRole = 'Trainer' | 'Nutritionist' | 'Client';

/**
 * Next role selection after clicking a card. Trainer and Nutritionist combine
 * (dual-role professionals); Client is exclusive with both, so picking it
 * replaces the selection and picking a coach role while Client is selected
 * replaces Client.
 */
export function toggleRole(current: RegistrableRole[], role: RegistrableRole): RegistrableRole[] {
  if (role === 'Client') {
    return current.includes('Client') ? [] : ['Client'];
  }
  const coachRoles = current.filter((existing) => existing !== 'Client');
  return coachRoles.includes(role)
    ? coachRoles.filter((existing) => existing !== role)
    : [...coachRoles, role];
}
