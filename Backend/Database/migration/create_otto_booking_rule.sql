CREATE TABLE IF NOT EXISTS otto_booking_rule (
    "code" TEXT PRIMARY KEY,
    "category" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT,
    "keywords" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "costcenter" TEXT,
    "accountingsubject" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO otto_booking_rule
    (code, category, name_zh, name_en, description, keywords, sort_order)
VALUES
    ('PARK', 'transport', '停车费', 'Parking', '停车费、车位租赁、车辆停放、停车场', '["停车", "停车费", "车位", "停车场", "parking"]', 10),
    ('TAXI', 'transport', '出租车网约车', 'Taxi', '出租车、网约车、滴滴、快车、专车、代驾', '["出租车", "网约车", "滴滴", "打车", "taxi", "didi"]', 20),
    ('AUTG', 'transport', '过路费', 'Highway Fee', '过路费、高速费、通行费、ETC、路桥费', '["过路费", "高速费", "通行费", "ETC", "路桥", "toll"]', 30),
    ('BENL', 'transport', '加油费', 'Petrol', '汽油、柴油、加油、燃油', '["汽油", "柴油", "加油", "燃油", "petrol", "diesel"]', 40),
    ('BAHC', 'transport', '火车票', 'Train Ticket', '火车票、高铁票、动车票、铁路', '["火车", "高铁", "动车", "铁路", "train"]', 50),
    ('FAHR', 'transport', '公交地铁', 'Bus/Subway', '地铁、公交、轻轨、城市轨道', '["地铁", "公交", "轻轨", "bus", "subway"]', 60),
    ('FLUG', 'transport', '机票', 'Flight', '机票、航空行程单、飞机票', '["机票", "航空", "飞机票", "flight"]', 70),
    ('MTWG', 'transport', '租车费', 'Rental Car', '租车、汽车租赁、车辆租赁', '["租车", "汽车租赁", "车辆租赁", "car rental"]', 80),
    ('HOTL', 'living', '酒店住宿', 'Hotel', '酒店、宾馆、旅馆、住宿、客房、民宿', '["酒店", "宾馆", "住宿", "客房", "hotel"]', 90),
    ('BEWI', 'living', '餐饮', 'Hospitality', '餐饮、餐厅、饭店、食堂、聚餐、工作餐', '["餐饮", "餐厅", "饭店", "食堂", "工作餐", "dining"]', 100),
    ('GE75', 'living', '礼品', 'Gift', '礼品、纪念品', '["礼品", "纪念品", "gift"]', 110),
    ('KOIN', 'office', '通信费', 'Communication', '通信费、话费、流量、宽带', '["通信费", "话费", "流量", "宽带", "communication"]', 120),
    ('POST', 'office', '快递邮费', 'Postal Fee', '快递、邮寄、邮费、物流', '["快递", "邮寄", "邮费", "物流", "postal"]', 130),
    ('PCKL', 'office', '电脑配件', 'PC Accessory', '电脑配件、数据线、转接器、底座、扩展坞', '["电脑配件", "数据线", "转接器", "扩展坞", "computer accessory"]', 140),
    ('BUCH', 'office', '书籍资料', 'Books', '书籍、图书、资料', '["书籍", "图书", "资料", "books"]', 150),
    ('BURO', 'office', '办公用品', 'Office Supply', '办公用品、文具、纸张、耗材', '["办公用品", "文具", "纸张", "耗材", "office supply"]', 160),
    ('PRIU', 'other', '私人住宿补贴', 'Private Overnight', '私人住宿补贴', '["私人住宿", "住宿补贴", "private overnight"]', 170),
    ('REST', 'other', '正餐晚餐', 'Food Dinner', '正餐、晚餐', '["正餐", "晚餐", "dinner"]', 180),
    ('SCHU', 'other', '培训教育', 'Training', '培训、教育、课程', '["培训", "教育", "课程", "training"]', 190),
    ('SOBE', 'other', '其他', 'Others', '其他或无法明确分类', '["其他", "无法识别", "others"]', 200)
ON CONFLICT (code) DO NOTHING;
