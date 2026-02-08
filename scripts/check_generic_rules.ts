import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from('jba_rules')
    .select('section_id, content')
    .in('section_id', ['規則_第50条 50-３', '規則_第2条 (part 1)', '規則_第３条', '規則_第49条 49-１', '規則_第50条 50-５ (part 3)', '規則_第８条 ８-9']);

  data?.forEach(r => {
    console.log('=== ' + r.section_id + ' ===');
    console.log(r.content.substring(0, 800));
    console.log('...(total length: ' + r.content.length + ' chars)');
    console.log();
  });
}

main();
