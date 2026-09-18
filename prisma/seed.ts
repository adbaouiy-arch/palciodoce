/**
 * Seeds Palácio Doce with its real categories, products (one per actual
 * product photograph), informational pages and an initial admin user.
 *
 * All customer-facing content is authored here in all three languages —
 * European Portuguese (pt-PT), international English and Modern
 * Standard Arabic — as a single product record per item with three
 * translations, never three separate products.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

type LocaleKey = "pt" | "en" | "ar";

type CategorySeed = {
  key: string;
  position: number;
  translations: Record<
    LocaleKey,
    {
      name: string;
      slug: string;
      description: string;
      seoTitle: string;
      seoDescription: string;
    }
  >;
};

const categories: CategorySeed[] = [
  {
    key: "sweets",
    position: 1,
    translations: {
      pt: {
        name: "Doces",
        slug: "doces",
        description:
          "Doces tradicionais e de autor, preparados diariamente na nossa pastelaria em Braga.",
        seoTitle: "Doces Artesanais em Braga",
        seoDescription:
          "Descubra os doces artesanais do Palácio Doce em Braga. Tarteletes, doces tradicionais e criações de autor, feitos frescos todos os dias.",
      },
      en: {
        name: "Sweets",
        slug: "sweets",
        description:
          "Traditional and signature sweets, prepared fresh every day at our pastry shop in Braga.",
        seoTitle: "Artisan Sweets in Braga",
        seoDescription:
          "Discover Palácio Doce's artisan sweets in Braga. Tartlets, traditional treats and signature creations, made fresh daily.",
      },
      ar: {
        name: "الحلويات",
        slug: "sweets",
        description:
          "حلويات تقليدية وأخرى من إبداعنا الخاص، تُحضَّر طازجة كل يوم في متجرنا في براغا.",
        seoTitle: "حلويات حرفية في براغا",
        seoDescription:
          "اكتشفوا الحلويات الحرفية من Palácio Doce في براغا. تارتات وحلويات تقليدية وإبداعات خاصة، تُحضَّر طازجة يومياً.",
      },
    },
  },
  {
    key: "cakes",
    position: 2,
    translations: {
      pt: {
        name: "Bolos",
        slug: "bolos",
        description:
          "Bolos e cheesecakes para aniversários, celebrações ou simplesmente para adoçar o dia.",
        seoTitle: "Bolos e Cheesecakes em Braga",
        seoDescription:
          "Encomende bolos artesanais e cheesecakes em Braga. Ideais para aniversários e celebrações, com entrega ao domicílio ou recolha em loja.",
      },
      en: {
        name: "Cakes",
        slug: "cakes",
        description:
          "Cakes and cheesecakes for birthdays, celebrations, or simply to sweeten the day.",
        seoTitle: "Cakes & Cheesecakes in Braga",
        seoDescription:
          "Order artisan cakes and cheesecakes in Braga. Perfect for birthdays and celebrations, with home delivery or in-store pickup.",
      },
      ar: {
        name: "الكيك",
        slug: "cakes",
        description:
          "كيك وتشيز كيك لأعياد الميلاد والمناسبات، أو ببساطة لإضفاء الحلاوة على يومكم.",
        seoTitle: "كيك وتشيز كيك في براغا",
        seoDescription:
          "اطلبوا الكيك والتشيز كيك الحرفي في براغا. مثالي لأعياد الميلاد والمناسبات، مع التوصيل إلى المنزل أو الاستلام من المتجر.",
      },
    },
  },
  {
    key: "desserts",
    position: 3,
    translations: {
      pt: {
        name: "Sobremesas",
        slug: "sobremesas",
        description:
          "Sobremesas individuais em copo, cremosas e prontas a servir.",
        seoTitle: "Sobremesas Individuais em Braga",
        seoDescription:
          "Sobremesas artesanais em copo, prontas a servir. Encomende as sobremesas do Palácio Doce em Braga com entrega ou recolha.",
      },
      en: {
        name: "Desserts",
        slug: "desserts",
        description:
          "Individual dessert cups, creamy and ready to serve.",
        seoTitle: "Individual Desserts in Braga",
        seoDescription:
          "Artisan dessert cups, ready to serve. Order Palácio Doce desserts in Braga with delivery or pickup.",
      },
      ar: {
        name: "الحلويات المميزة",
        slug: "desserts",
        description:
          "حلويات فردية في أكواب، كريمية وجاهزة للتقديم.",
        seoTitle: "حلويات فردية مميزة في براغا",
        seoDescription:
          "حلويات حرفية في أكواب، جاهزة للتقديم. اطلبوا حلويات Palácio Doce في براغا مع خدمة التوصيل أو الاستلام.",
      },
    },
  },
  {
    key: "gift-boxes",
    position: 4,
    translations: {
      pt: {
        name: "Caixas & Presentes",
        slug: "caixas-e-presentes",
        description:
          "Caixas de degustação e conjuntos para presente, prontos a oferecer.",
        seoTitle: "Caixas de Doces e Presentes em Braga",
        seoDescription:
          "Caixas de degustação e presentes doces em Braga. Ofereça uma seleção do Palácio Doce, com entrega ao domicílio ou recolha em loja.",
      },
      en: {
        name: "Gift Boxes",
        slug: "gift-boxes",
        description:
          "Tasting boxes and gift sets, ready to give.",
        seoTitle: "Sweet Gift Boxes in Braga",
        seoDescription:
          "Tasting boxes and sweet gifts in Braga. Give a selection from Palácio Doce, with home delivery or in-store pickup.",
      },
      ar: {
        name: "علب الهدايا",
        slug: "gift-boxes",
        description: "علب تذوّق ومجموعات هدايا، جاهزة للإهداء.",
        seoTitle: "علب هدايا الحلويات في براغا",
        seoDescription:
          "علب تذوّق وهدايا حلويات في براغا. أهدوا تشكيلة من Palácio Doce، مع التوصيل إلى المنزل أو الاستلام من المتجر.",
      },
    },
  },
];

type ProductSeed = {
  sku: string;
  categoryKey: string;
  priceCents: number;
  weightGrams: number | null;
  stock: number | null;
  isFeatured: boolean;
  position: number;
  image: { url: string; alt: string };
  translations: Record<
    LocaleKey,
    {
      name: string;
      slug: string;
      shortDescription: string;
      description: string;
      ingredients: string;
      allergens: string;
      storageInformation: string;
      seoTitle: string;
      seoDescription: string;
    }
  >;
};

const products: ProductSeed[] = [
  {
    sku: "PD-CHK-001",
    categoryKey: "cakes",
    priceCents: 2450,
    weightGrams: 1200,
    stock: null,
    isFeatured: true,
    position: 1,
    image: {
      url: "/images/products/strawberry-cheesecake.webp",
      alt: "Cheesecake de frutos vermelhos com cobertura brilhante e morangos frescos",
    },
    translations: {
      pt: {
        name: "Cheesecake de Frutos Vermelhos",
        slug: "cheesecake-frutos-vermelhos",
        shortDescription:
          "Cheesecake cremoso sobre base de bolacha, coberto com geleia de frutos vermelhos e morangos frescos.",
        description:
          "O nosso cheesecake de frutos vermelhos é uma das criações mais pedidas do Palácio Doce. Uma base crocante de bolacha suporta um recheio de queijo creme sedoso e pouco doce, finalizado com uma camada brilhante de geleia de frutos vermelhos e morangos frescos cortados à mão. Servimo-lo bem frio, o que realça o contraste entre a acidez da fruta e a suavidade do creme. Ideal para aniversários, jantares em família ou simplesmente para terminar uma refeição em grande. Disponível por encomenda, com entrega em Braga ou recolha na nossa loja.",
        ingredients:
          "Queijo creme, nata, açúcar, ovos, bolacha (farinha de trigo, açúcar, óleo vegetal), manteiga, frutos vermelhos (morango, framboesa), gelatina, sumo de limão, amido de milho.",
        allergens:
          "Contém leite, ovos, glúten (trigo) e soja. Pode conter vestígios de frutos de casca rija.",
        storageInformation:
          "Conservar no frigorífico entre 2 °C e 5 °C. Consumir preferencialmente nas 48 horas seguintes à entrega. Retirar do frio 10 minutos antes de servir.",
        seoTitle: "Cheesecake de Frutos Vermelhos | Encomendar em Braga",
        seoDescription:
          "Cheesecake artesanal de frutos vermelhos, feito em Braga. Base de bolacha, creme sedoso e geleia de frutos vermelhos. Encomende com entrega ou recolha.",
      },
      en: {
        name: "Red Berry Cheesecake",
        slug: "red-berry-cheesecake",
        shortDescription:
          "Creamy cheesecake on a biscuit base, topped with red berry glaze and fresh strawberries.",
        description:
          "Our red berry cheesecake is one of Palácio Doce's most requested creations. A crisp biscuit base supports a silky, gently sweet cream cheese filling, finished with a glossy layer of red berry glaze and hand-cut fresh strawberries. We serve it well chilled, which brings out the contrast between the fruit's brightness and the smoothness of the cream. Perfect for birthdays, family dinners, or simply to end a meal on a high note. Available to order, with delivery in Braga or pickup at our shop.",
        ingredients:
          "Cream cheese, cream, sugar, eggs, biscuit (wheat flour, sugar, vegetable oil), butter, red berries (strawberry, raspberry), gelatine, lemon juice, cornstarch.",
        allergens:
          "Contains milk, eggs, gluten (wheat) and soy. May contain traces of nuts.",
        storageInformation:
          "Keep refrigerated between 2 °C and 5 °C. Best enjoyed within 48 hours of delivery. Remove from the fridge 10 minutes before serving.",
        seoTitle: "Red Berry Cheesecake | Order in Braga",
        seoDescription:
          "Artisan red berry cheesecake, made in Braga. Biscuit base, silky cream filling and red berry glaze. Order with delivery or pickup.",
      },
      ar: {
        name: "تشيز كيك التوت الأحمر",
        slug: "red-berry-cheesecake",
        shortDescription:
          "تشيز كيك كريمي على قاعدة بسكويت، مغطى بصلصة التوت الأحمر والفراولة الطازجة.",
        description:
          "تشيز كيك التوت الأحمر هو أحد أكثر إبداعات Palácio Doce طلباً. قاعدة بسكويت مقرمشة تحمل حشوة من الجبن الكريمي الحريرية وقليلة الحلاوة، تُزيَّن بطبقة لامعة من صلصة التوت الأحمر والفراولة الطازجة المقطّعة يدوياً. نقدّمه بارداً تماماً، ما يبرز التباين بين حموضة الفواكه ونعومة الكريمة. مثالي لأعياد الميلاد والعشاء العائلي، أو ببساطة لإنهاء وجبتكم بلمسة مميزة. متوفر عند الطلب، مع خدمة التوصيل داخل براغا أو الاستلام من متجرنا.",
        ingredients:
          "جبن كريمي، كريمة، سكر، بيض، بسكويت (دقيق قمح، سكر، زيت نباتي)، زبدة، توت أحمر (فراولة، توت العليق)، جيلاتين، عصير ليمون، نشا الذرة.",
        allergens:
          "يحتوي على الحليب والبيض والغلوتين (القمح) والصويا. قد يحتوي على آثار من المكسرات.",
        storageInformation:
          "يُحفظ في الثلاجة بين ٢ و٥ درجات مئوية. يُفضّل تناوله خلال ٤٨ ساعة من الاستلام. أخرجوه من الثلاجة ١٠ دقائق قبل التقديم.",
        seoTitle: "تشيز كيك التوت الأحمر | اطلبوه في براغا",
        seoDescription:
          "تشيز كيك التوت الأحمر الحرفي، مصنوع في براغا. قاعدة بسكويت وحشوة كريمية حريرية وصلصة توت أحمر. اطلبوه مع التوصيل أو الاستلام.",
      },
    },
  },
  {
    sku: "PD-TRT-002",
    categoryKey: "sweets",
    priceCents: 1650,
    weightGrams: 480,
    stock: null,
    isFeatured: true,
    position: 2,
    image: {
      url: "/images/products/almond-tarts.webp",
      alt: "Tarteletes de amêndoa laminada caramelizada dispostas num prato dourado",
    },
    translations: {
      pt: {
        name: "Tarteletes de Amêndoa",
        slug: "tarteletes-de-amendoa",
        shortDescription:
          "Conjunto de tarteletes de massa quebrada com amêndoa laminada caramelizada. Vendidas em caixa de 8.",
        description:
          "Um clássico da pastelaria portuguesa, feito como deve ser. Massa quebrada amanteigada, cozida até ficar dourada e crocante, preenchida com um creme de amêndoa suave e coberta com amêndoa laminada caramelizada que estala levemente ao primeiro contacto. São preparadas em pequenos lotes ao longo do dia, o que garante frescura e uma textura que se mantém. Perfeitas para acompanhar um café, para receber visitas em casa ou para levar como lembrança de Braga. Caixa de 8 unidades.",
        ingredients:
          "Farinha de trigo, manteiga, amêndoa laminada, açúcar, ovos, nata, mel, sal.",
        allergens:
          "Contém glúten (trigo), leite, ovos e frutos de casca rija (amêndoa).",
        storageInformation:
          "Conservar em local fresco e seco, em recipiente fechado, até 4 dias. Não refrigerar, para preservar a textura crocante da massa.",
        seoTitle: "Tarteletes de Amêndoa | Doces Artesanais em Braga",
        seoDescription:
          "Tarteletes de amêndoa artesanais, feitas em Braga. Massa quebrada amanteigada e amêndoa laminada caramelizada. Caixa de 8, com entrega ou recolha.",
      },
      en: {
        name: "Almond Tartlets",
        slug: "almond-tartlets",
        shortDescription:
          "A set of shortcrust tartlets with caramelised flaked almonds. Sold in a box of 8.",
        description:
          "A Portuguese pastry classic, made the way it should be. Buttery shortcrust pastry, baked until golden and crisp, filled with a smooth almond cream and topped with caramelised flaked almonds that crackle gently at first bite. They're prepared in small batches throughout the day, which keeps them fresh and preserves a texture that holds. Perfect alongside a coffee, for having guests over, or to take home as a memento of Braga. Box of 8.",
        ingredients:
          "Wheat flour, butter, flaked almonds, sugar, eggs, cream, honey, salt.",
        allergens: "Contains gluten (wheat), milk, eggs and nuts (almond).",
        storageInformation:
          "Store in a cool, dry place in a sealed container for up to 4 days. Do not refrigerate, to preserve the pastry's crispness.",
        seoTitle: "Almond Tartlets | Artisan Sweets in Braga",
        seoDescription:
          "Artisan almond tartlets, made in Braga. Buttery shortcrust pastry and caramelised flaked almonds. Box of 8, with delivery or pickup.",
      },
      ar: {
        name: "تارتات اللوز",
        slug: "almond-tartlets",
        shortDescription:
          "تشكيلة من تارتات العجين المقرمش مع رقائق اللوز المكرملة. تُقدَّم في علبة من ٨ قطع.",
        description:
          "طبق كلاسيكي من الحلويات البرتغالية، مُحضَّر كما يجب أن يكون. عجينة مقرمشة غنية بالزبدة، تُخبز حتى تصبح ذهبية اللون، ثم تُحشى بكريمة اللوز الناعمة وتُغطى برقائق اللوز المكرملة التي تُطقطق برفق عند أول قضمة. تُحضَّر بكميات صغيرة على مدار اليوم، ما يحافظ على طزاجتها وقوامها المقرمش. مثالية مع فنجان قهوة، أو لاستقبال الضيوف في المنزل، أو لأخذها كذكرى من براغا. علبة من ٨ قطع.",
        ingredients: "دقيق قمح، زبدة، رقائق لوز، سكر، بيض، كريمة، عسل، ملح.",
        allergens: "يحتوي على الغلوتين (القمح) والحليب والبيض والمكسرات (اللوز).",
        storageInformation:
          "يُحفظ في مكان بارد وجاف داخل وعاء محكم الإغلاق لمدة تصل إلى ٤ أيام. لا يُحفظ في الثلاجة، للحفاظ على قرمشة العجين.",
        seoTitle: "تارتات اللوز | حلويات حرفية في براغا",
        seoDescription:
          "تارتات اللوز الحرفية، مصنوعة في براغا. عجينة مقرمشة بالزبدة ورقائق لوز مكرملة. علبة من ٨ قطع، مع التوصيل أو الاستلام.",
      },
    },
  },
  {
    sku: "PD-DES-003",
    categoryKey: "desserts",
    priceCents: 550,
    weightGrams: 180,
    stock: null,
    isFeatured: true,
    position: 3,
    image: {
      url: "/images/products/lotus-biscoff-trifle.webp",
      alt: "Copo de sobremesa com creme e bolacha Lotus caramelizada",
    },
    translations: {
      pt: {
        name: "Copo de Bolacha Caramelizada",
        slug: "copo-bolacha-caramelizada",
        shortDescription:
          "Sobremesa individual em copo, com creme de bolacha caramelizada e camadas de bolacha esmigalhada.",
        description:
          "Camadas alternadas de bolacha caramelizada esmigalhada e um creme aveludado com notas de canela e caramelo, terminadas com uma cobertura lisa de pasta de bolacha e uma bolacha inteira no topo. É uma sobremesa reconfortante, servida no copo em que é montada, pronta a comer com colher. Um dos favoritos de quem visita a nossa loja em Braga, especialmente ao fim da tarde com um café. Vendido individualmente.",
        ingredients:
          "Bolacha caramelizada (farinha de trigo, açúcar, óleo vegetal, canela), queijo mascarpone, nata, leite condensado, açúcar, gelatina.",
        allergens:
          "Contém glúten (trigo), leite e soja. Pode conter vestígios de frutos de casca rija.",
        storageInformation:
          "Conservar no frigorífico entre 2 °C e 5 °C e consumir nas 48 horas seguintes. Servir frio.",
        seoTitle: "Copo de Bolacha Caramelizada | Sobremesas em Braga",
        seoDescription:
          "Sobremesa individual em copo com creme de bolacha caramelizada, feita em Braga. Encomende no Palácio Doce com entrega ou recolha.",
      },
      en: {
        name: "Caramelised Biscuit Cup",
        slug: "caramelised-biscuit-cup",
        shortDescription:
          "An individual dessert cup with caramelised biscuit cream and layers of crushed biscuit.",
        description:
          "Alternating layers of crushed caramelised biscuit and a velvety cream with notes of cinnamon and caramel, finished with a smooth biscuit-spread topping and a whole biscuit on top. It's a comforting dessert, served in the cup it's assembled in and ready to eat with a spoon. A favourite among visitors to our shop in Braga, especially late afternoon with a coffee. Sold individually.",
        ingredients:
          "Caramelised biscuit (wheat flour, sugar, vegetable oil, cinnamon), mascarpone cheese, cream, condensed milk, sugar, gelatine.",
        allergens: "Contains gluten (wheat), milk and soy. May contain traces of nuts.",
        storageInformation:
          "Keep refrigerated between 2 °C and 5 °C and consume within 48 hours. Serve chilled.",
        seoTitle: "Caramelised Biscuit Cup | Desserts in Braga",
        seoDescription:
          "Individual dessert cup with caramelised biscuit cream, made in Braga. Order from Palácio Doce with delivery or pickup.",
      },
      ar: {
        name: "كوب البسكويت المكرمل",
        slug: "caramelised-biscuit-cup",
        shortDescription:
          "حلوى فردية في كوب، بكريمة البسكويت المكرمل وطبقات من البسكويت المفروم.",
        description:
          "طبقات متعاقبة من البسكويت المكرمل المفروم وكريمة مخملية بلمسات من القرفة والكراميل، تُزيَّن بطبقة ناعمة من معجون البسكويت وقطعة بسكويت كاملة في الأعلى. حلوى مريحة تُقدَّم في الكوب نفسه الذي حُضِّرت فيه، جاهزة للتناول بالملعقة. من أكثر الأصناف المفضّلة لزوّار متجرنا في براغا، خاصة في وقت العصر مع فنجان قهوة. تُبَاع بشكل فردي.",
        ingredients:
          "بسكويت مكرمل (دقيق قمح، سكر، زيت نباتي، قرفة)، جبن ماسكربوني، كريمة، حليب مكثّف، سكر، جيلاتين.",
        allergens:
          "يحتوي على الغلوتين (القمح) والحليب والصويا. قد يحتوي على آثار من المكسرات.",
        storageInformation:
          "يُحفظ في الثلاجة بين ٢ و٥ درجات مئوية ويُستهلك خلال ٤٨ ساعة. يُقدَّم بارداً.",
        seoTitle: "كوب البسكويت المكرمل | حلويات مميزة في براغا",
        seoDescription:
          "حلوى فردية في كوب بكريمة البسكويت المكرمل، مصنوعة في براغا. اطلبوها من Palácio Doce مع التوصيل أو الاستلام.",
      },
    },
  },
  {
    sku: "PD-DES-004",
    categoryKey: "desserts",
    priceCents: 550,
    weightGrams: 180,
    stock: null,
    isFeatured: false,
    position: 4,
    image: {
      url: "/images/products/oreo-matcha-trifle.webp",
      alt: "Copo de sobremesa de matcha com bolacha de cacau esmigalhada",
    },
    translations: {
      pt: {
        name: "Copo de Matcha e Bolacha de Cacau",
        slug: "copo-matcha-bolacha-cacau",
        shortDescription:
          "Creme de matcha suave em camadas com bolacha de cacau esmigalhada. Sobremesa individual em copo.",
        description:
          "Uma sobremesa para quem gosta de sabores menos doces. O creme de matcha é preparado com chá verde em pó de qualidade, o que lhe dá a cor viva e um travo herbáceo característico que equilibra o açúcar. Alterna com camadas generosas de bolacha de cacau esmigalhada, criando um contraste de cor e textura tão bonito quanto saboroso. Montada e servida no copo, pronta a comer. Vendido individualmente.",
        ingredients:
          "Queijo mascarpone, nata, leite, açúcar, chá verde matcha em pó, bolacha de cacau (farinha de trigo, açúcar, cacau, óleo vegetal), gelatina.",
        allergens:
          "Contém glúten (trigo), leite e soja. Pode conter vestígios de frutos de casca rija.",
        storageInformation:
          "Conservar no frigorífico entre 2 °C e 5 °C e consumir nas 48 horas seguintes. Servir frio.",
        seoTitle: "Copo de Matcha e Bolacha de Cacau | Sobremesas Braga",
        seoDescription:
          "Sobremesa individual de matcha com bolacha de cacau, feita em Braga. Encomende no Palácio Doce com entrega ao domicílio ou recolha.",
      },
      en: {
        name: "Matcha & Cocoa Biscuit Cup",
        slug: "matcha-cocoa-biscuit-cup",
        shortDescription:
          "Smooth matcha cream layered with crushed cocoa biscuit. An individual dessert cup.",
        description:
          "A dessert for those who prefer less sweetness. The matcha cream is made with quality powdered green tea, giving it that vivid colour and a characteristic herbaceous edge that balances the sugar. It alternates with generous layers of crushed cocoa biscuit, creating a contrast of colour and texture that's as striking as it is good to eat. Assembled and served in the cup, ready to enjoy. Sold individually.",
        ingredients:
          "Mascarpone cheese, cream, milk, sugar, matcha green tea powder, cocoa biscuit (wheat flour, sugar, cocoa, vegetable oil), gelatine.",
        allergens: "Contains gluten (wheat), milk and soy. May contain traces of nuts.",
        storageInformation:
          "Keep refrigerated between 2 °C and 5 °C and consume within 48 hours. Serve chilled.",
        seoTitle: "Matcha & Cocoa Biscuit Cup | Desserts in Braga",
        seoDescription:
          "Individual matcha dessert with cocoa biscuit, made in Braga. Order from Palácio Doce with home delivery or pickup.",
      },
      ar: {
        name: "كوب الماتشا وبسكويت الكاكاو",
        slug: "matcha-cocoa-biscuit-cup",
        shortDescription:
          "كريمة ماتشا ناعمة بطبقات مع بسكويت الكاكاو المفروم. حلوى فردية في كوب.",
        description:
          "حلوى لمن يفضّلون المذاق الأقل حلاوة. تُحضَّر كريمة الماتشا من مسحوق الشاي الأخضر عالي الجودة، ما يمنحها لونها الزاهي ولمسة عشبية مميزة توازن حلاوة السكر. تتعاقب مع طبقات سخية من بسكويت الكاكاو المفروم، لتخلق تبايناً في اللون والقوام لا يقل جمالاً عن مذاقه. تُحضَّر وتُقدَّم في الكوب، جاهزة للتناول. تُبَاع بشكل فردي.",
        ingredients:
          "جبن ماسكربوني، كريمة، حليب، سكر، مسحوق شاي الماتشا الأخضر، بسكويت كاكاو (دقيق قمح، سكر، كاكاو، زيت نباتي)، جيلاتين.",
        allergens:
          "يحتوي على الغلوتين (القمح) والحليب والصويا. قد يحتوي على آثار من المكسرات.",
        storageInformation:
          "يُحفظ في الثلاجة بين ٢ و٥ درجات مئوية ويُستهلك خلال ٤٨ ساعة. يُقدَّم بارداً.",
        seoTitle: "كوب الماتشا وبسكويت الكاكاو | حلويات في براغا",
        seoDescription:
          "حلوى ماتشا فردية مع بسكويت الكاكاو، مصنوعة في براغا. اطلبوها من Palácio Doce مع التوصيل إلى المنزل أو الاستلام.",
      },
    },
  },
  {
    sku: "PD-BOX-005",
    categoryKey: "gift-boxes",
    priceCents: 2600,
    weightGrams: 900,
    stock: null,
    isFeatured: true,
    position: 5,
    image: {
      url: "/images/products/mixed-trifles.webp",
      alt: "Seleção de copos de sobremesa variados numa travessa de pedra",
    },
    translations: {
      pt: {
        name: "Caixa Degustação Palácio Doce",
        slug: "caixa-degustacao",
        shortDescription:
          "Cinco sobremesas individuais numa seleção variada, prontas a oferecer ou a partilhar.",
        description:
          "A melhor forma de conhecer o Palácio Doce, ou de oferecer algo que agrada a todos. A caixa reúne cinco das nossas sobremesas individuais em copo, numa seleção que combina os sabores mais pedidos — matcha com bolacha de cacau e bolacha caramelizada entre eles. Cada copo vem selado individualmente e a caixa é apresentada pronta a entregar, o que a torna prática para levar a um jantar, marcar uma data ou simplesmente ter em casa. A composição exata pode variar ligeiramente conforme a produção do dia; indique-nos preferências nas notas da encomenda e faremos o possível para as respeitar.",
        ingredients:
          "Consultar a lista de ingredientes de cada sobremesa incluída. Base comum: queijo mascarpone, nata, leite, açúcar, bolacha (farinha de trigo, açúcar, óleo vegetal), gelatina.",
        allergens:
          "Contém glúten (trigo), leite e soja. Pode conter frutos de casca rija e ovos, conforme a seleção incluída.",
        storageInformation:
          "Conservar no frigorífico entre 2 °C e 5 °C e consumir nas 48 horas seguintes à entrega. Servir frio.",
        seoTitle: "Caixa Degustação de Doces | Presentes em Braga",
        seoDescription:
          "Caixa de degustação com cinco sobremesas individuais do Palácio Doce, em Braga. Ideal para presente, com entrega ao domicílio ou recolha em loja.",
      },
      en: {
        name: "Palácio Doce Tasting Box",
        slug: "tasting-box",
        shortDescription:
          "Five individual desserts in a varied selection, ready to give or to share.",
        description:
          "The best way to get to know Palácio Doce, or to give something that pleases everyone. The box brings together five of our individual dessert cups in a selection combining our most requested flavours — matcha with cocoa biscuit and caramelised biscuit among them. Each cup is sealed individually and the box arrives presented and ready to hand over, which makes it practical for taking to a dinner, marking an occasion, or simply keeping at home. The exact composition may vary slightly according to the day's production; let us know your preferences in the order notes and we'll do our best to accommodate them.",
        ingredients:
          "Please refer to the ingredient list of each dessert included. Common base: mascarpone cheese, cream, milk, sugar, biscuit (wheat flour, sugar, vegetable oil), gelatine.",
        allergens:
          "Contains gluten (wheat), milk and soy. May contain nuts and eggs, depending on the selection included.",
        storageInformation:
          "Keep refrigerated between 2 °C and 5 °C and consume within 48 hours of delivery. Serve chilled.",
        seoTitle: "Sweet Tasting Box | Gifts in Braga",
        seoDescription:
          "A tasting box with five individual Palácio Doce desserts, in Braga. Ideal as a gift, with home delivery or in-store pickup.",
      },
      ar: {
        name: "علبة تذوّق Palácio Doce",
        slug: "tasting-box",
        shortDescription:
          "خمس حلويات فردية في تشكيلة متنوعة، جاهزة للإهداء أو للمشاركة.",
        description:
          "أفضل طريقة للتعرّف على Palácio Doce، أو لإهداء شيء يُرضي الجميع. تجمع العلبة خمساً من حلوياتنا الفردية في أكواب، في تشكيلة تضم أكثر النكهات طلباً — منها الماتشا مع بسكويت الكاكاو والبسكويت المكرمل. كل كوب مُغلَّف بشكل منفصل، وتُقدَّم العلبة جاهزة للإهداء، ما يجعلها عملية لأخذها إلى عشاء، أو للاحتفال بمناسبة، أو ببساطة للاستمتاع بها في المنزل. قد تختلف المكوّنات الدقيقة قليلاً حسب إنتاج اليوم؛ أخبرونا بتفضيلاتكم في ملاحظات الطلب وسنبذل ما في وسعنا لتحقيقها.",
        ingredients:
          "يرجى مراجعة قائمة مكونات كل حلوى مُدرَجة. القاعدة المشتركة: جبن ماسكربوني، كريمة، حليب، سكر، بسكويت (دقيق قمح، سكر، زيت نباتي)، جيلاتين.",
        allergens:
          "يحتوي على الغلوتين (القمح) والحليب والصويا. قد يحتوي على المكسرات والبيض، حسب التشكيلة المُدرَجة.",
        storageInformation:
          "تُحفظ في الثلاجة بين ٢ و٥ درجات مئوية وتُستهلك خلال ٤٨ ساعة من الاستلام. تُقدَّم باردة.",
        seoTitle: "علبة تذوّق الحلويات | هدايا في براغا",
        seoDescription:
          "علبة تذوّق تضم خمس حلويات فردية من Palácio Doce، في براغا. مثالية كهدية، مع التوصيل إلى المنزل أو الاستلام من المتجر.",
      },
    },
  },
];

type PageSeed = {
  key: string;
  translations: Record<
    LocaleKey,
    { title: string; content: string; seoTitle: string; seoDescription: string }
  >;
};

const pages: PageSeed[] = [
  {
    key: "privacy",
    translations: {
      pt: {
        title: "Política de Privacidade",
        seoTitle: "Política de Privacidade",
        seoDescription:
          "Como o Palácio Doce recolhe, utiliza e protege os seus dados pessoais, em conformidade com o RGPD.",
        content: `## Quem somos

O Palácio Doce, com estabelecimento em R. de Santa Margarida 13, 4710-311 Braga, Portugal, é responsável pelo tratamento dos dados pessoais recolhidos através deste site.

## Que dados recolhemos

Recolhemos apenas os dados necessários para processar as suas encomendas e responder aos seus pedidos:

- **Dados de identificação e contacto:** nome, email e telefone.
- **Dados de entrega:** endereço, localidade e código postal, quando escolhe entrega ao domicílio.
- **Dados da encomenda:** produtos, quantidades, valores, método de pagamento, data pretendida e notas que nos indique.
- **Idioma preferido:** guardado para lhe apresentar o site no idioma que escolheu.

Não recolhemos dados de cartões de pagamento neste site.

## Para que utilizamos os seus dados

- Processar, preparar e entregar as suas encomendas.
- Comunicar consigo sobre o estado da sua encomenda.
- Cumprir obrigações legais e fiscais.

A base legal para o tratamento é a execução do contrato de compra e venda e, quanto às obrigações fiscais, o cumprimento de obrigação legal.

## Durante quanto tempo conservamos os dados

Conservamos os dados das encomendas durante o período exigido pela legislação fiscal portuguesa. Os dados que não sejam necessários para esse fim são eliminados quando deixam de ser precisos.

## Com quem partilhamos os dados

Partilhamos dados apenas com quem é estritamente necessário para lhe entregar a encomenda, como o serviço de entrega. Não vendemos nem cedemos os seus dados para fins de marketing de terceiros.

## Os seus direitos

Tem o direito de acesso, retificação, apagamento, limitação do tratamento, portabilidade e oposição relativamente aos seus dados pessoais. Para exercer qualquer destes direitos, contacte-nos através do telefone +351 929 311 701 ou presencialmente na nossa loja.

Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).

## Cookies

Utilizamos cookies essenciais ao funcionamento do site e, com o seu consentimento, cookies opcionais. Consulte a nossa Política de Cookies para mais detalhes e para alterar as suas preferências.`,
      },
      en: {
        title: "Privacy Policy",
        seoTitle: "Privacy Policy",
        seoDescription:
          "How Palácio Doce collects, uses and protects your personal data, in compliance with the GDPR.",
        content: `## Who we are

Palácio Doce, located at R. de Santa Margarida 13, 4710-311 Braga, Portugal, is the controller responsible for the personal data collected through this website.

## What data we collect

We collect only the data needed to process your orders and respond to your requests:

- **Identification and contact data:** name, email and phone number.
- **Delivery data:** address, city and postal code, when you choose home delivery.
- **Order data:** products, quantities, amounts, payment method, requested date and any notes you provide.
- **Preferred language:** stored so we can show you the site in the language you chose.

We do not collect payment card data on this website.

## What we use your data for

- Processing, preparing and delivering your orders.
- Communicating with you about the status of your order.
- Meeting legal and tax obligations.

The legal basis for processing is the performance of the sales contract and, for tax obligations, compliance with a legal obligation.

## How long we keep data

We keep order data for the period required by Portuguese tax law. Data not needed for that purpose is deleted once it is no longer required.

## Who we share data with

We share data only with those strictly necessary to deliver your order, such as the delivery service. We do not sell or pass on your data for third-party marketing purposes.

## Your rights

You have the right of access, rectification, erasure, restriction of processing, portability and objection regarding your personal data. To exercise any of these rights, contact us on +351 929 311 701 or in person at our shop.

You also have the right to lodge a complaint with the Portuguese Data Protection Authority (CNPD).

## Cookies

We use cookies that are essential to the site's operation and, with your consent, optional cookies. See our Cookie Policy for details and to change your preferences.`,
      },
      ar: {
        title: "سياسة الخصوصية",
        seoTitle: "سياسة الخصوصية",
        seoDescription:
          "كيف يجمع Palácio Doce بياناتكم الشخصية ويستخدمها ويحميها، وفقاً لللائحة العامة لحماية البيانات (GDPR).",
        content: `## من نحن

Palácio Doce، الكائن في R. de Santa Margarida 13, 4710-311 Braga, Portugal، هو المسؤول عن معالجة البيانات الشخصية التي تُجمَع من خلال هذا الموقع.

## البيانات التي نجمعها

نجمع فقط البيانات اللازمة لمعالجة طلباتكم والرد على استفساراتكم:

- **بيانات الهوية والتواصل:** الاسم والبريد الإلكتروني ورقم الهاتف.
- **بيانات التوصيل:** العنوان والمدينة والرمز البريدي، عند اختياركم التوصيل إلى المنزل.
- **بيانات الطلب:** المنتجات والكميات والمبالغ وطريقة الدفع والتاريخ المطلوب وأي ملاحظات تقدّمونها.
- **اللغة المفضّلة:** تُحفظ لنعرض لكم الموقع باللغة التي اخترتموها.

لا نجمع بيانات بطاقات الدفع على هذا الموقع.

## أغراض استخدام بياناتكم

- معالجة طلباتكم وتحضيرها وتوصيلها.
- التواصل معكم بشأن حالة طلبكم.
- الوفاء بالالتزامات القانونية والضريبية.

الأساس القانوني للمعالجة هو تنفيذ عقد البيع، وفيما يتعلق بالالتزامات الضريبية، الامتثال لالتزام قانوني.

## مدة الاحتفاظ بالبيانات

نحتفظ ببيانات الطلبات للمدة التي يقتضيها القانون الضريبي البرتغالي. تُحذف البيانات غير اللازمة لهذا الغرض عندما تنتهي الحاجة إليها.

## الجهات التي نشارك معها البيانات

نشارك البيانات فقط مع الجهات الضرورية لتوصيل طلبكم، مثل خدمة التوصيل. لا نبيع بياناتكم ولا نمنحها لأطراف ثالثة لأغراض تسويقية.

## حقوقكم

لكم الحق في الوصول إلى بياناتكم الشخصية وتصحيحها ومحوها وتقييد معالجتها ونقلها والاعتراض عليها. لممارسة أي من هذه الحقوق، تواصلوا معنا على الرقم ‎+351 929 311 701‎ أو شخصياً في متجرنا.

كما يحق لكم تقديم شكوى إلى الهيئة الوطنية لحماية البيانات في البرتغال (CNPD).

## ملفات تعريف الارتباط

نستخدم ملفات تعريف ارتباط أساسية لتشغيل الموقع، وملفات اختيارية بموافقتكم. راجعوا سياسة ملفات تعريف الارتباط لمزيد من التفاصيل ولتغيير تفضيلاتكم.`,
      },
    },
  },
  {
    key: "terms",
    translations: {
      pt: {
        title: "Termos e Condições",
        seoTitle: "Termos e Condições",
        seoDescription:
          "Condições de venda, encomenda, entrega e pagamento aplicáveis às compras no Palácio Doce.",
        content: `## Objeto

Estes termos regulam a compra de produtos de pastelaria através do site palaciodoce.pt, explorado pelo Palácio Doce, com estabelecimento em R. de Santa Margarida 13, 4710-311 Braga.

## Encomendas

As encomendas são confirmadas depois de submetidas através do site. Reservamo-nos o direito de contactar o cliente para confirmar detalhes, disponibilidade ou a data pretendida.

Uma parte significativa dos nossos produtos é preparada por encomenda. Por esse motivo, pedimos que as encomendas sejam feitas com a antecedência possível, especialmente para bolos e caixas.

## Preços e pagamento

Todos os preços são apresentados em euros (€) e incluem IVA à taxa legal aplicável. Aceitamos MB WAY, transferência bancária e pagamento em dinheiro na recolha ou na entrega.

A encomenda é preparada após confirmação do pagamento, exceto quando o pagamento em dinheiro na entrega ou na recolha for a opção escolhida.

## Entrega e recolha

Efetuamos entregas na área de Braga. A taxa de entrega é calculada no momento da finalização da compra. A recolha em loja não tem custos adicionais.

Pedimos que confirme a disponibilidade para receber a encomenda na data e morada indicadas. Em caso de ausência, entraremos em contacto para reagendar; produtos perecíveis podem não ser passíveis de nova entrega.

## Direito de livre resolução

Nos termos da legislação portuguesa aplicável, o direito de livre resolução não se aplica a bens alimentares perecíveis, o que inclui a generalidade dos produtos do Palácio Doce.

Se um produto for entregue em condições que não correspondam ao encomendado, contacte-nos no prazo de 24 horas para que possamos resolver a situação.

## Alergénios

A informação sobre alergénios está indicada em cada produto. Os nossos produtos são preparados numa cozinha onde se manipulam glúten, leite, ovos e frutos de casca rija, pelo que não podemos garantir a ausência total de vestígios.

## Contactos

Para qualquer questão relativa a estes termos: +351 929 311 701.`,
      },
      en: {
        title: "Terms & Conditions",
        seoTitle: "Terms & Conditions",
        seoDescription:
          "Conditions of sale, ordering, delivery and payment applicable to purchases from Palácio Doce.",
        content: `## Scope

These terms govern the purchase of pastry products through palaciodoce.pt, operated by Palácio Doce, located at R. de Santa Margarida 13, 4710-311 Braga, Portugal.

## Orders

Orders are confirmed after being submitted through the website. We reserve the right to contact the customer to confirm details, availability or the requested date.

A significant portion of our products is made to order. For that reason, we ask that orders be placed as far in advance as possible, particularly for cakes and boxes.

## Prices and payment

All prices are shown in euros (€) and include VAT at the applicable legal rate. We accept MB WAY, bank transfer and cash payment on pickup or delivery.

Orders are prepared after payment is confirmed, except where cash on delivery or on pickup is the chosen option.

## Delivery and pickup

We deliver within the Braga area. The delivery fee is calculated at checkout. In-store pickup carries no additional cost.

Please confirm your availability to receive the order at the date and address given. If you are not there, we will contact you to reschedule; perishable products may not be eligible for a second delivery attempt.

## Right of withdrawal

Under applicable Portuguese law, the right of withdrawal does not apply to perishable food goods, which covers most Palácio Doce products.

If a product is delivered in a condition that does not match what was ordered, contact us within 24 hours so we can put it right.

## Allergens

Allergen information is stated on each product. Our products are prepared in a kitchen where gluten, milk, eggs and nuts are handled, so we cannot guarantee the complete absence of traces.

## Contact

For any question regarding these terms: +351 929 311 701.`,
      },
      ar: {
        title: "الشروط والأحكام",
        seoTitle: "الشروط والأحكام",
        seoDescription:
          "شروط البيع والطلب والتوصيل والدفع المطبَّقة على عمليات الشراء من Palácio Doce.",
        content: `## نطاق التطبيق

تنظّم هذه الشروط عملية شراء منتجات الحلويات من خلال موقع palaciodoce.pt، الذي يديره Palácio Doce، الكائن في R. de Santa Margarida 13, 4710-311 Braga, Portugal.

## الطلبات

تُعتمَد الطلبات بعد تقديمها عبر الموقع. نحتفظ بالحق في التواصل مع العميل لتأكيد التفاصيل أو التوفّر أو التاريخ المطلوب.

يُحضَّر جزء كبير من منتجاتنا عند الطلب. لذلك نرجو تقديم الطلبات مسبقاً بأكبر قدر ممكن، خاصة بالنسبة للكيك وعلب الهدايا.

## الأسعار والدفع

جميع الأسعار معروضة باليورو (€) وتشمل ضريبة القيمة المضافة بالنسبة القانونية المطبَّقة. نقبل الدفع عبر MB WAY والحوالة المصرفية والدفع نقداً عند الاستلام أو التوصيل.

يُحضَّر الطلب بعد تأكيد الدفع، إلا في حال اختيار الدفع نقداً عند التوصيل أو الاستلام.

## التوصيل والاستلام

نوفّر التوصيل داخل منطقة براغا. تُحسب رسوم التوصيل عند إتمام الطلب. الاستلام من المتجر لا يترتب عليه أي تكلفة إضافية.

نرجو تأكيد جهوزيتكم لاستلام الطلب في التاريخ والعنوان المحدَّدين. في حال عدم تواجدكم، سنتواصل معكم لإعادة الجدولة؛ وقد لا تكون المنتجات القابلة للتلف مؤهَّلة لمحاولة توصيل ثانية.

## حق التراجع

بموجب القانون البرتغالي المطبَّق، لا ينطبق حق التراجع على المواد الغذائية القابلة للتلف، وهو ما يشمل معظم منتجات Palácio Doce.

إذا وصل أي منتج بحالة لا تطابق ما طُلب، تواصلوا معنا خلال ٢٤ ساعة لنعالج الأمر.

## مسببات الحساسية

معلومات مسببات الحساسية مذكورة على كل منتج. تُحضَّر منتجاتنا في مطبخ يُتعامَل فيه مع الغلوتين والحليب والبيض والمكسرات، لذا لا يمكننا ضمان الغياب التام لأي آثار منها.

## للتواصل

لأي استفسار يتعلق بهذه الشروط: ‎+351 929 311 701‎.`,
      },
    },
  },
  {
    key: "cookies",
    translations: {
      pt: {
        title: "Política de Cookies",
        seoTitle: "Política de Cookies",
        seoDescription:
          "Que cookies o Palácio Doce utiliza, para que servem e como pode alterar as suas preferências.",
        content: `## O que são cookies

Cookies são pequenos ficheiros de texto guardados no seu dispositivo quando visita um site. Servem para que o site funcione corretamente e, quando o autoriza, para recolher informação sobre a utilização.

## Cookies essenciais

Estes cookies são necessários para o funcionamento do site e não podem ser desativados:

- **Idioma selecionado:** guarda a língua que escolheu (Português, English ou العربية), para que a encontre na próxima visita.
- **Carrinho de compras:** guarda os produtos que adicionou, para que não os perca ao navegar.
- **Consentimento de cookies:** guarda as suas preferências de cookies, para não lhe voltarmos a perguntar em cada página.

## Cookies opcionais

Só são utilizados se der o seu consentimento:

- **Análise:** ajudam-nos a compreender que páginas são mais visitadas, para melhorarmos o site.
- **Marketing:** permitem-nos apresentar conteúdo e ofertas mais relevantes.

## Como alterar as suas preferências

Pode aceitar, rejeitar ou personalizar as categorias opcionais no aviso apresentado na primeira visita. Pode também apagar os cookies em qualquer momento nas definições do seu navegador; note que apagar os cookies essenciais faz com que o site esqueça o idioma escolhido e o conteúdo do carrinho.`,
      },
      en: {
        title: "Cookie Policy",
        seoTitle: "Cookie Policy",
        seoDescription:
          "Which cookies Palácio Doce uses, what they are for, and how you can change your preferences.",
        content: `## What cookies are

Cookies are small text files stored on your device when you visit a website. They allow the site to work correctly and, where you allow it, to collect information about how it is used.

## Essential cookies

These cookies are necessary for the site to function and cannot be disabled:

- **Selected language:** stores the language you chose (Português, English or العربية), so it's there on your next visit.
- **Shopping cart:** stores the products you added, so you don't lose them while browsing.
- **Cookie consent:** stores your cookie preferences, so we don't ask again on every page.

## Optional cookies

These are only used if you give your consent:

- **Analytics:** help us understand which pages are visited most, so we can improve the site.
- **Marketing:** allow us to show more relevant content and offers.

## How to change your preferences

You can accept, reject or customise the optional categories in the notice shown on your first visit. You can also delete cookies at any time in your browser settings; note that deleting the essential cookies will make the site forget your chosen language and cart contents.`,
      },
      ar: {
        title: "سياسة ملفات تعريف الارتباط",
        seoTitle: "سياسة ملفات تعريف الارتباط",
        seoDescription:
          "ملفات تعريف الارتباط التي يستخدمها Palácio Doce، والغرض منها، وكيف يمكنكم تغيير تفضيلاتكم.",
        content: `## ما هي ملفات تعريف الارتباط

ملفات تعريف الارتباط هي ملفات نصية صغيرة تُخزَّن على جهازكم عند زيارة أي موقع. تتيح للموقع العمل بشكل صحيح، وعند إذنكم بذلك، جمع معلومات عن طريقة استخدامه.

## ملفات تعريف الارتباط الأساسية

هذه الملفات ضرورية لعمل الموقع ولا يمكن إيقاف تشغيلها:

- **اللغة المختارة:** تحفظ اللغة التي اخترتموها (Português أو English أو العربية)، لتجدوها في زيارتكم القادمة.
- **سلة التسوق:** تحفظ المنتجات التي أضفتموها، حتى لا تفقدوها أثناء التصفّح.
- **الموافقة على ملفات تعريف الارتباط:** تحفظ تفضيلاتكم، لتجنّب سؤالكم مرة أخرى في كل صفحة.

## ملفات تعريف الارتباط الاختيارية

تُستخدَم فقط في حال منحكم موافقتكم:

- **التحليلات:** تساعدنا على معرفة الصفحات الأكثر زيارة، لتحسين الموقع.
- **التسويق:** تتيح لنا تقديم محتوى وعروض أكثر ملاءمة لكم.

## كيفية تغيير تفضيلاتكم

يمكنكم قبول الفئات الاختيارية أو رفضها أو تخصيصها من خلال الإشعار الذي يظهر عند زيارتكم الأولى. يمكنكم أيضاً حذف ملفات تعريف الارتباط في أي وقت من إعدادات المتصفّح؛ مع الإشارة إلى أن حذف الملفات الأساسية سيؤدي إلى نسيان الموقع للغة التي اخترتموها ولمحتويات سلتكم.`,
      },
    },
  },
];

const LOCALES: LocaleKey[] = ["pt", "en", "ar"];

async function main() {
  console.log("Seeding Palácio Doce…");

  // --- Categories -------------------------------------------------------
  const categoryIdByKey = new Map<string, string>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { key: category.key },
      update: { position: category.position, isActive: true },
      create: { key: category.key, position: category.position, isActive: true },
    });
    categoryIdByKey.set(category.key, record.id);

    for (const locale of LOCALES) {
      const t = category.translations[locale];
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: record.id, locale } },
        update: {
          name: t.name,
          slug: t.slug,
          description: t.description,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
        create: {
          categoryId: record.id,
          locale,
          name: t.name,
          slug: t.slug,
          description: t.description,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
      });
    }
  }
  console.log(`  ✓ ${categories.length} categories (× ${LOCALES.length} locales)`);

  // --- Products ---------------------------------------------------------
  for (const product of products) {
    const categoryId = categoryIdByKey.get(product.categoryKey);
    if (!categoryId) throw new Error(`Unknown category key: ${product.categoryKey}`);

    const record = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        categoryId,
        priceCents: product.priceCents,
        weightGrams: product.weightGrams,
        stock: product.stock,
        isFeatured: product.isFeatured,
        position: product.position,
        isActive: true,
      },
      create: {
        sku: product.sku,
        categoryId,
        priceCents: product.priceCents,
        weightGrams: product.weightGrams,
        stock: product.stock,
        isFeatured: product.isFeatured,
        position: product.position,
        isActive: true,
      },
    });

    // Images: replace so re-seeding stays idempotent.
    await prisma.productImage.deleteMany({ where: { productId: record.id } });
    await prisma.productImage.create({
      data: {
        productId: record.id,
        url: product.image.url,
        alt: product.image.alt,
        position: 0,
      },
    });

    for (const locale of LOCALES) {
      const t = product.translations[locale];
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: record.id, locale } },
        update: {
          name: t.name,
          slug: t.slug,
          shortDescription: t.shortDescription,
          description: t.description,
          ingredients: t.ingredients,
          allergens: t.allergens,
          storageInformation: t.storageInformation,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
        create: {
          productId: record.id,
          locale,
          name: t.name,
          slug: t.slug,
          shortDescription: t.shortDescription,
          description: t.description,
          ingredients: t.ingredients,
          allergens: t.allergens,
          storageInformation: t.storageInformation,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
      });
    }
  }
  console.log(`  ✓ ${products.length} products (× ${LOCALES.length} locales)`);

  // --- Informational pages ---------------------------------------------
  for (const page of pages) {
    const record = await prisma.page.upsert({
      where: { key: page.key },
      update: {},
      create: { key: page.key },
    });

    for (const locale of LOCALES) {
      const t = page.translations[locale];
      await prisma.pageTranslation.upsert({
        where: { pageId_locale: { pageId: record.id, locale } },
        update: {
          title: t.title,
          content: t.content,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
        create: {
          pageId: record.id,
          locale,
          title: t.title,
          content: t.content,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
      });
    }
  }
  console.log(`  ✓ ${pages.length} pages (× ${LOCALES.length} locales)`);

  // --- Admin user -------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@palaciodoce.pt";

  /*
    No fallback password, deliberately.

    A default baked into source is a published credential once this repo is
    pushed anywhere: seed a deployment without `ADMIN_PASSWORD` set and its
    dashboard would be reachable by anyone who read this file. Failing loudly
    is the safe behaviour — the person seeding has to make a choice.
  */
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must be set (12+ characters) before seeding.\n" +
        "  Add it to .env, or run it inline:\n" +
        '    ADMIN_PASSWORD="your-strong-password" npm run db:seed',
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Administração Palácio Doce",
      email: adminEmail,
      passwordHash,
      role: "admin",
    },
  });
  console.log(`  ✓ admin user: ${adminEmail}`);

  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
