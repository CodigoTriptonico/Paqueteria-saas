import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectPg } from './lib/db-connection.mjs';

const { client, label } = await connectPg();
console.log(`Testing commercial inheritance on ${label}`);

let authScopeCounter = 0;

async function authenticated(userId, task) {
  authScopeCounter += 1;
  const savepoint = `authenticated_scope_${authScopeCounter}`;
  await client.query(`savepoint ${savepoint}`);
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  try {
    const result = await task();
    await client.query('reset role');
    await client.query(`release savepoint ${savepoint}`);
    return result;
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query('reset role');
    await client.query(`release savepoint ${savepoint}`);
    throw error;
  }
}

await client.query('begin');
try {
  const matrixResult = await client.query(`
    select organization.id, organization.tenant_id, profile.id admin_user_id
    from public.organizations organization
    join public.profiles profile on profile.organization_id=organization.id
    join public.roles role on role.id=profile.role_id and role.slug='administrador'
    where organization.organization_type='matrix' order by profile.created_at limit 1
  `);
  assert.equal(matrixResult.rowCount, 1, 'matrix administrator required');
  const matrix = matrixResult.rows[0];
  let catalogResult = await client.query(`
    select country.code, coalesce(nullif(box.catalog_key,''),box.size) product_code
    from public.pricing_countries country join public.pricing_country_boxes box on box.country_id=country.id
    where country.organization_id=$1 order by country.sort_order,box.id limit 1
  `,[matrix.id]);
  if (!catalogResult.rowCount) {
    const countryId = randomUUID();
    await client.query(`insert into public.pricing_countries(id,organization_id,code,name,sort_order) values($1,$2,'QA','Pais QA',999)`,[countryId,matrix.id]);
    await client.query(`insert into public.pricing_country_boxes(organization_id,country_id,size,price,cost,catalog_key) values($1,$2,'Caja QA','$150','$100','qa-box')`,[matrix.id,countryId]);
    catalogResult = await client.query(`select 'QA'::text code,'qa-box'::text product_code`);
  }
  const catalog = catalogResult.rows[0];
  const agencyIds = [randomUUID(),randomUUID()];
  const agencyOrgIds = [randomUUID(),randomUUID()];
  for(let index=0;index<2;index+=1){
    await client.query(`insert into public.organizations(id,name,slug,tenant_id,organization_type,organization_code,matrix_organization_id) values($1,$2,$3,$4,'agency',$5,$6)`,[agencyOrgIds[index],`Agency QA ${index}`,`agency-qa-${agencyIds[index].slice(0,8)}`,matrix.tenant_id,`QA-${index}`,matrix.id]);
    await client.query(`insert into public.agencies(id,tenant_id,matrix_organization_id,organization_id,code,status) values($1,$2,$3,$4,$5,'active')`,[agencyIds[index],matrix.tenant_id,matrix.id,agencyOrgIds[index],`QA-${index}`]);
  }
  let countryAmount;
  await authenticated(matrix.admin_user_id, async()=>{
    const country=await client.query(`select public.resolve_commercial_price('agency',$1,$2,$3,'public','international_shipping',now()) data`,[agencyIds[0],catalog.code,catalog.product_code]);
    countryAmount=Number(country.rows[0].data.amountCents); assert.equal(country.rows[0].data.sourceLevel,'country');
    await client.query(`select public.save_commercial_price_override('agency',null,$1,$2,'public','international_shipping',$3,null,'USD','{"type":"fixed"}'::jsonb,$4)`,[catalog.code,catalog.product_code,countryAmount+100,randomUUID()]);
    const group=await client.query(`select public.resolve_commercial_price('agency',$1,$2,$3,'public','international_shipping',now()) data`,[agencyIds[0],catalog.code,catalog.product_code]);
    assert.equal(group.rows[0].data.sourceLevel,'group'); assert.equal(Number(group.rows[0].data.amountCents),countryAmount+100);
    const saved=await client.query(`select public.save_commercial_price_override('agency',$1,$2,$3,'public','international_shipping',$4,null,'USD','{"type":"fixed"}'::jsonb,$5) data`,[agencyIds[0],catalog.code,catalog.product_code,countryAmount+200,randomUUID()]);
    const entity=await client.query(`select public.resolve_commercial_price('agency',$1,$2,$3,'public','international_shipping',now()) data`,[agencyIds[0],catalog.code,catalog.product_code]);
    assert.equal(entity.rows[0].data.sourceLevel,'entity'); assert.equal(Number(entity.rows[0].data.amountCents),countryAmount+200);
    const otherAgency=await client.query(`select public.resolve_commercial_price('agency',$1,$2,$3,'public','international_shipping',now()) data`,[agencyIds[1],catalog.code,catalog.product_code]);
    assert.equal(otherAgency.rows[0].data.sourceLevel,'group');
    await client.query(`select public.restore_commercial_price_inheritance($1,$2)`,[saved.rows[0].data.overrideId,randomUUID()]);
    const restored=await client.query(`select public.resolve_commercial_price('agency',$1,$2,$3,'public','international_shipping',now()) data`,[agencyIds[0],catalog.code,catalog.product_code]);
    assert.equal(restored.rows[0].data.sourceLevel,'group');
    await client.query(`select public.save_commercial_price_override('seller',null,$1,$2,'public','international_shipping',$3,null,'USD','{"type":"fixed"}'::jsonb,$4)`,[catalog.code,catalog.product_code,countryAmount+300,randomUUID()]);
    const seller=await client.query(`select public.resolve_commercial_price('seller',$1,$2,$3,'public','international_shipping',now()) data`,[matrix.admin_user_id,catalog.code,catalog.product_code]);
    assert.equal(seller.rows[0].data.sourceLevel,'group');
    const routeIds=[randomUUID(),randomUUID()];
    await client.query(`insert into public.logistics_route_templates(id,organization_id,weekday,name) values($1,$3,1,'Ruta QA 1'),($2,$3,2,'Ruta QA 2')`,[routeIds[0],routeIds[1],matrix.id]);
    await client.query(`select public.change_agency_default_route($1,$2,'Inicial',$3)`,[agencyIds[0],routeIds[0],randomUUID()]);
    await client.query(`select public.change_agency_default_route($1,$2,'Cambio',$3)`,[agencyIds[0],routeIds[1],randomUUID()]);
  });
  const history=await client.query(`select count(*)::int total,count(*) filter(where ended_at is null)::int active from public.agency_default_route_assignments where agency_id=$1`,[agencyIds[0]]);
  assert.deepEqual(history.rows[0],{total:2,active:1});
  const platform=await client.query(`select user_id from public.platform_admins limit 1`);
  if(platform.rowCount){await assert.rejects(()=>authenticated(platform.rows[0].user_id,()=>client.query(`select public.save_commercial_price_override('agency',null,$1,$2,'public','international_shipping',100,null,'USD','{}'::jsonb,$3)`,[catalog.code,catalog.product_code,randomUUID()])));}
  console.log(JSON.stringify({countryInheritance:'pass',groupOverride:'pass',entityOverride:'pass',restoreInheritance:'pass',sellerParity:'pass',agencySpecificPricing:'pass',routeHistory:'pass',unauthorizedMutation:'pass'},null,2));
} finally { await client.query('rollback'); await client.end(); }
