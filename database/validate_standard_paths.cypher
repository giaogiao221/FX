MATCH (s:KGNode {entity_type: 'Standard'})-[:STANDARD_RULE]->(c:KGNode {entity_type: 'Clause'})-[:STANDARD_RULE]->(r:KGNode)
MATCH (r)-[:STANDARD_RULE]->(e:KGNode {entity_type: 'Evidence'})
RETURN s.name AS standard, c.name AS clause, r.name AS rule, e.name AS evidence
LIMIT 3;
