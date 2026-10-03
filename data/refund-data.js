export const refundPolicy = {
  version: 'v3.2',
  windowDays: 30,
  damagedDays: 7,
  autoApprovalLimit: 50000,
  nonRefundableCategories: ['Digital Products', 'Gift Cards', 'Personalized Products', 'Opened Hygiene Products', 'Final Sale Products'],
  paymentTiming: '5–7 business days',
}

const names = ['Maya Chen','Liam Smith','Ava Patel','Noah Williams','Sofia Garcia','Ethan Brown','Olivia Davis','James Wilson','Isabella Martinez','Lucas Anderson','Amelia Thomas','Benjamin Taylor','Harper Moore','Henry Jackson','Evelyn White']
const colors = ['violet','blue','amber','emerald','rose','cyan','pink','indigo','orange','teal','fuchsia','lime','sky','yellow','slate']
export const customers = names.map((name, index) => {
  const [first, last] = name.split(' ')
  return { id: `CUS-${1001 + index}`, name, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`, phone: `+91 98${String(10000000 + index * 73129).slice(0, 8)}`, address: `${10 + index}, Lakeview Avenue, Bengaluru, India`, customerSince: `202${index % 3 + 3}-0${index % 9 + 1}-15`, status: index === 4 ? 'Inactive' : 'Active', tier: index % 5 === 0 ? 'Enterprise' : index % 2 ? 'Plus' : 'Pro', orders: 2 + index * 2, lifetimeValue: 1800 + index * 1430, avatar: first[0] + last[0], color: `bg-${colors[index]}-100 text-${colors[index]}-700` }
})

export const orders = customers.flatMap((customer, index) => {
  const amount = [4999, 12999, 74999, 2499, 899, 15999, 5499, 3299, 75000, 2199, 6499, 2899, 799, 45999, 1899][index]
  const category = index === 4 ? 'Gift Cards' : index === 8 ? 'Personalized Products' : index === 9 ? 'Digital Products' : 'Electronics'
  const daysAgo = [14, 45, 5, 12, 21, 8, 36, 3, 10, 14, 7, 18, 2, 29, 11][index]
  const delivered = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
  return [{ id: `ORD-${1001 + index}`, customerId: customer.id, product: ['Wireless Headphones','Smart Watch','Pro Laptop','Air Purifier','Gift Card','Mechanical Keyboard','Tablet Stand','Noise Cancelling Buds','Custom Office Desk','Online Course','4K Monitor','USB Hub','Cloud Software License','Designer Chair','Webcam'][index], category, amount, orderDate: new Date(Date.now() - (daysAgo + 5) * 86400000).toISOString().slice(0, 10), deliveryDate: delivered, status: index === 2 ? 'Shipped' : index === 3 ? 'Cancelled' : 'Delivered', paymentMethod: index % 2 ? 'Card' : 'UPI', refundStatus: index === 5 ? 'Approved' : 'Not Refunded' }]
})

export const refunds = [{ id: 'REF-1001', customerId: 'CUS-1006', orderId: 'ORD-1006', amount: 15999, reason: 'Changed my mind', decision: 'APPROVED', status: 'Approved', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), denialReason: '' }]
export const agentLogs = []
export const users = [{ email: 'admin@example.com', password: 'admin123', role: 'admin', name: 'Jordan Davis' }, ...customers.map((customer, index) => ({ email: customer.email, password: `customer${1001 + index}`, role: 'customer', name: customer.name, customerId: customer.id }))]

export function getCustomer(value) { return customers.find((item) => item.id === value || item.email.toLowerCase() === String(value || '').toLowerCase()) }
export function getOrder(customerId, orderId) { return orders.find((item) => item.id.toLowerCase() === String(orderId || '').toLowerCase() && (!customerId || item.customerId === customerId)) }
export function getPolicy() { return refundPolicy }
export function checkRefundEligibility({ customerId, orderId, refundReason = 'Customer requested a refund' }) {
  const order = getOrder(customerId, orderId)
  if (!order) return { decision: 'DENIED', eligible: false, reason: `Order ${orderId || ''} was not found or does not belong to this customer.` }
  if (order.status !== 'Delivered') return { decision: 'DENIED', eligible: false, order, reason: `This order is ${order.status.toLowerCase()}, so it cannot enter the delivered-order refund workflow.` }
  if (order.refundStatus !== 'Not Refunded' || refunds.some((r) => r.orderId === order.id && r.status === 'Approved')) return { decision: 'DENIED', eligible: false, order, reason: 'Refund has already been processed for this order.' }
  const days = Math.floor((Date.now() - new Date(order.deliveryDate).getTime()) / 86400000)
  if (days > refundPolicy.windowDays) return { decision: 'DENIED', eligible: false, order, reason: 'The refund request is outside the 30-day refund window.' }
  if (refundPolicy.nonRefundableCategories.includes(order.category)) return { decision: 'DENIED', eligible: false, order, reason: `${order.category} are non-refundable under the current policy.` }
  if (order.amount > refundPolicy.autoApprovalLimit) return { decision: 'MANUAL_REVIEW', eligible: false, order, reason: 'Order value exceeds the ₹50,000 automated approval limit.' }
  if (/damaged|broken|defect/i.test(refundReason) && days > refundPolicy.damagedDays) return { decision: 'MANUAL_REVIEW', eligible: false, order, reason: 'Damaged-product reports must be submitted within 7 days of delivery.' }
  return { decision: 'APPROVED', eligible: true, order, amount: order.amount, reason: 'All automated refund policy checks passed.' }
}
export function createRefund({ customerId, orderId, amount, reason, decision = 'APPROVED', status = 'Approved', denialReason = '' }) {
  const refund = { id: `REF-${1000 + refunds.length + 1}`, customerId, orderId, amount, reason, decision, status, denialReason, createdAt: new Date().toISOString() }
  refunds.push(refund)
  const order = orders.find((item) => item.id === orderId); if (order && status === 'Approved') order.refundStatus = 'Approved'
  return refund
}
export function logAgent({ executionId, customerId, request, tool, input, output, status = 'SUCCESS', error = '' }) { const log = { executionId, customerId, request, tool, input, output, status, error, timestamp: new Date().toISOString(), duration: `${Math.floor(Math.random() * 180 + 60)}ms` }; agentLogs.unshift(log); return log }
export const defaultCustomer = customers[0]
export const policy = { title: 'Refund Policy', rules: ['30 calendar day window from delivery', 'Delivered orders only', 'Non-refundable product categories are blocked', 'Damaged items reported within 7 days', 'Orders above ₹50,000 require manual review', 'One refund per order'] }

export function getStats() { return { customers: customers.length, orders: orders.length, refunds: refunds.length, approved: refunds.filter((r) => r.status === 'Approved').length, denied: refunds.filter((r) => r.status === 'Denied').length, manual: refunds.filter((r) => r.status === 'Manual Review').length } }
export function createAgentLogs(result) { return [{ label: 'Customer identified', detail: 'CRM profile verified', time: '00:01', status: 'complete' }, { label: 'Order retrieved', detail: result.order ? `${result.order.id} · ₹${result.order.amount.toLocaleString('en-IN')}` : result.reason, time: '00:02', status: result.order ? 'complete' : 'warning' }, { label: 'Policy retrieved', detail: 'refund-policy-v3.2', time: '00:03', status: 'complete' }, { label: 'Eligibility checked', detail: result.reason, time: '00:04', status: result.decision === 'APPROVED' ? 'complete' : 'warning' }, { label: `Decision: ${result.decision}`, detail: result.reason, time: '00:05', status: result.decision === 'APPROVED' ? 'complete' : 'warning' }] }

export default { customers, orders, refunds, agentLogs }

// Compatibility alias for older UI code.
export const evaluateRefund = ({ amount = 129, daysSinceDelivery = 14, itemCondition = 'unused', itemType = 'physical' }) => ({ checks: [{ key: 'window', label: '30-day return window', passed: daysSinceDelivery <= 30, detail: `${daysSinceDelivery} days since delivery` }, { key: 'condition', label: 'Original condition', passed: itemCondition === 'unused', detail: itemCondition }, { key: 'type', label: 'Eligible product type', passed: itemType === 'physical', detail: itemType }, { key: 'value', label: 'Automated limit', passed: amount <= 50000, detail: `₹${amount}` }], decision: daysSinceDelivery <= 30 && itemCondition === 'unused' && itemType === 'physical' && amount <= 50000 ? 'approved' : 'denied' })
