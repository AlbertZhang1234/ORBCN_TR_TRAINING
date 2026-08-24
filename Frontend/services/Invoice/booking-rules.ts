export interface BookingRuleOption {
  code: string;
  category: 'transport' | 'living' | 'office' | 'other';
  label: string;
}

export const BOOKING_RULE_OPTIONS: BookingRuleOption[] = [
  { code: 'PARK', category: 'transport', label: 'PARK - Parking / 停车费' },
  { code: 'TAXI', category: 'transport', label: 'TAXI - Taxi / 出租车网约车' },
  { code: 'AUTG', category: 'transport', label: 'AUTG - Highway Fee / 过路费' },
  { code: 'BENL', category: 'transport', label: 'BENL - Petrol / 加油费' },
  { code: 'BAHC', category: 'transport', label: 'BAHC - Train Ticket / 火车票' },
  { code: 'FAHR', category: 'transport', label: 'FAHR - Bus/Subway / 公交地铁' },
  { code: 'FLUG', category: 'transport', label: 'FLUG - Flight / 机票' },
  { code: 'MTWG', category: 'transport', label: 'MTWG - Rental Car / 租车' },
  { code: 'HOTL', category: 'living', label: 'HOTL - Hotel / 酒店住宿' },
  { code: 'BEWI', category: 'living', label: 'BEWI - Hospitality / 餐饮' },
  { code: 'GE75', category: 'living', label: 'GE75 - Gift / 礼品' },
  { code: 'KOIN', category: 'office', label: 'KOIN - Communication / 通信费' },
  { code: 'POST', category: 'office', label: 'POST - Postal Fee / 快递邮费' },
  { code: 'PCKL', category: 'office', label: 'PCKL - PC Accessory / 电脑配件' },
  { code: 'BUCH', category: 'office', label: 'BUCH - Books / 书籍资料' },
  { code: 'BURO', category: 'office', label: 'BURO - Office Supply / 办公用品' },
  { code: 'PRIU', category: 'other', label: 'PRIU - Private Overnight / 私人住宿补贴' },
  { code: 'REST', category: 'other', label: 'REST - Food Dinner / 正餐晚餐' },
  { code: 'SCHU', category: 'other', label: 'SCHU - Training / 培训' },
  { code: 'SOBE', category: 'other', label: 'SOBE - Others / 其他' },
];
